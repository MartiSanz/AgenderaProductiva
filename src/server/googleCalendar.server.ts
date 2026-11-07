/**
 * Server-only Google Calendar helpers shared by server functions and the
 * background sync job. They receive an explicit Supabase client so they can be
 * used both with the request-scoped (RLS) client and the service-role client.
 */
import { callAsAppUser } from "@/integrations/lovable/appUserConnector";

export const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";
export const CONNECTOR_ID = "google_calendar";
export const DEFAULT_TIMEZONE = "America/Argentina/Buenos_Aires";

export type SupabaseLike = { from: (table: string) => any };

export async function gcal(
  connectionAPIKey: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return callAsAppUser({
    gatewayBaseUrl: GATEWAY_BASE_URL,
    connectionAPIKey,
    connectorId: CONNECTOR_ID,
    path,
    init,
  });
}

export async function gcalJson<T>(
  connectionAPIKey: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await gcal(connectionAPIKey, path, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Calendar (${res.status}): ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

/**
 * Makes sure the calendar shows up (and is checked) in the professional's
 * Google Calendar UI. A calendar created through the API can end up hidden or
 * unselected in the calendar list.
 */
export async function ensureCalendarVisible(
  connectionAPIKey: string,
  calendarId: string,
): Promise<void> {
  const encoded = encodeURIComponent(calendarId);
  const patch = await gcal(connectionAPIKey, `/calendar/v3/users/me/calendarList/${encoded}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ selected: true, hidden: false }),
  });
  if (patch.ok) return;
  await gcal(connectionAPIKey, `/calendar/v3/users/me/calendarList`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: calendarId, selected: true, hidden: false }),
  });
}

/**
 * Returns the id of the dedicated "turnos" calendar, creating (or reusing by
 * name) it in the professional's Google account when needed.
 */
export async function resolveTurnosCalendarId(
  db: SupabaseLike,
  ownerId: string,
  connectionAPIKey: string,
): Promise<string> {
  const { data: cfg, error } = await db
    .from("professional_config")
    .select("google_calendar_id, google_calendar_name, timezone, display_name")
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error) throw new Error(error.message);

  const name = (cfg?.google_calendar_name || "Turnos").trim();
  const timeZone = cfg?.timezone || DEFAULT_TIMEZONE;

  if (cfg?.google_calendar_id) {
    const res = await gcal(
      connectionAPIKey,
      `/calendar/v3/calendars/${encodeURIComponent(cfg.google_calendar_id)}`,
    );
    if (res.ok) {
      await ensureCalendarVisible(connectionAPIKey, cfg.google_calendar_id as string).catch(() => {});
      return cfg.google_calendar_id as string;
    }
    // calendar was deleted in Google: fall through and re-create it
  }

  // Reuse an existing calendar with the same name before creating a new one.
  const list = await gcalJson<{ items?: Array<{ id: string; summary?: string; accessRole?: string }> }>(
    connectionAPIKey,
    `/calendar/v3/users/me/calendarList?maxResults=250`,
  );
  const existing = (list.items ?? []).find(
    (c) => (c.summary ?? "").trim().toLowerCase() === name.toLowerCase() && c.accessRole === "owner",
  );

  const calendarId =
    existing?.id ??
    (
      await gcalJson<{ id: string }>(connectionAPIKey, `/calendar/v3/calendars`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: name,
          description: `Agenda de turnos${cfg?.display_name ? ` de ${cfg.display_name}` : ""}`,
          timeZone,
        }),
      })
    ).id;

  const { error: upErr } = await db
    .from("professional_config")
    .update({ google_calendar_id: calendarId, google_calendar_name: name })
    .eq("owner_id", ownerId);
  if (upErr) throw new Error(upErr.message);

  await ensureCalendarVisible(connectionAPIKey, calendarId).catch(() => {});

  return calendarId;
}

export type GEvent = {
  id: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  status?: string;
  extendedProperties?: { private?: Record<string, string> };
};

/** Kind marker written on every event the app manages in the "Turnos" calendar. */
export type AppEventKind = "appointment" | "time_off";

export function eventKind(event: GEvent): AppEventKind | null {
  const kind = event.extendedProperties?.private?.["lovable_kind"];
  return kind === "appointment" || kind === "time_off" ? kind : null;
}

export function kindProps(kind: AppEventKind, extra: Record<string, string> = {}) {
  return { extendedProperties: { private: { lovable_kind: kind, ...extra } } };
}

/** Adds one day to a YYYY-MM-DD date (Google all-day end dates are exclusive). */
export function nextDay(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Creates an all-day event (used for vacation / leave periods). */
export async function insertAllDayEvent(
  connectionAPIKey: string,
  calendarId: string,
  args: { summary: string; startDate: string; endDate: string; kind: AppEventKind; props?: Record<string, string> },
): Promise<string> {
  return insertEvent(connectionAPIKey, calendarId, {
    summary: args.summary,
    start: { date: args.startDate },
    end: { date: nextDay(args.endDate) },
    transparency: "opaque",
    ...kindProps(args.kind, args.props ?? {}),
  });
}

export async function listEventsOfCalendar(
  connectionAPIKey: string,
  calendarId: string,
  timeMin: string,
  timeMax: string,
): Promise<GEvent[]> {
  const query = new URLSearchParams({ timeMin, timeMax, singleEvents: "true", maxResults: "2500" });
  const res = await gcal(
    connectionAPIKey,
    `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${query.toString()}`,
    { method: "GET", headers: { "Content-Type": "application/json" } },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Calendar list failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const body = (await res.json()) as { items?: GEvent[] };
  return body.items ?? [];
}

export async function insertEvent(
  connectionAPIKey: string,
  calendarId: string,
  payload: Record<string, unknown>,
): Promise<string> {
  // Timed events get a popup notification 5 minutes before they start.
  const start = payload.start as { dateTime?: string } | undefined;
  if (start?.dateTime && payload.reminders === undefined) {
    payload = {
      ...payload,
      reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 5 }] },
    };
  }
  const res = await gcal(
    connectionAPIKey,
    `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Calendar create failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const body = (await res.json()) as { id: string };
  return body.id;
}

export async function patchEvent(
  connectionAPIKey: string,
  calendarId: string,
  eventId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  // Timed events keep a popup notification 5 minutes before they start.
  const start = payload.start as { dateTime?: string } | undefined;
  if (start?.dateTime && payload.reminders === undefined) {
    payload = {
      ...payload,
      reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 5 }] },
    };
  }
  const res = await gcal(
    connectionAPIKey,
    `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Calendar update failed (${res.status}): ${text.slice(0, 200)}`);
  }
}

export async function removeEvent(
  connectionAPIKey: string,
  calendarId: string,
  eventId: string,
): Promise<void> {
  const res = await gcal(
    connectionAPIKey,
    `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: "DELETE" },
  );
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const text = await res.text();
    throw new Error(`Google Calendar delete failed (${res.status}): ${text.slice(0, 200)}`);
  }
}

/** Fetches a single event by id. Returns null when Google reports it as gone. */
export async function getEvent(
  connectionAPIKey: string,
  calendarId: string,
  eventId: string,
): Promise<GEvent | null> {
  const res = await gcal(
    connectionAPIKey,
    `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: "GET", headers: { "Content-Type": "application/json" } },
  );
  if (res.status === 404 || res.status === 410) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Calendar get failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const body = (await res.json()) as GEvent;
  if (body.status === "cancelled") return null;
  return body;
}
