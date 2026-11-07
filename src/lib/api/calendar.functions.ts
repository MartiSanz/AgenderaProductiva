import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  authorizeAppUserOAuth,
  disconnectAppUser,
  exchangeAppUserOAuthCode,
} from "@/integrations/lovable/appUserConnector";
import {
  getConnectionKeyForUser,
  saveConnectionKeyForUser,
  deleteConnectionKeyForUser,
  getConnectionSlot,
  bumpConnectionSlot,
  appUserIdForSlot,
} from "@/server/appUserConnections.server";
import {
  CONNECTOR_ID,
  DEFAULT_TIMEZONE,
  gcal,
  listEventsOfCalendar,
  resolveTurnosCalendarId as resolveCalendarId,
} from "@/server/googleCalendar.server";
import { syncOwnerCalendar } from "@/server/calendarSync.server";
import { safeOrigin } from "@/lib/oauthOrigin";

const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";
const CLIENT_API_KEY_ENV = "GOOGLE_CALENDAR_APP_USER_CONNECTOR_CLIENT_API_KEY";

const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
];

function requireClientApiKey(): string {
  const key = process.env[CLIENT_API_KEY_ENV];
  if (!key) throw new Error(`${CLIENT_API_KEY_ENV} is not set`);
  return key;
}

type SupabaseCtx = { supabase: any; userId: string };
const isFigmaDemo = () => process.env.VITE_FIGMA_AUTH_BYPASS === "1";

async function demoCalendarConnected(context: SupabaseCtx) {
  const { data } = await context.supabase
    .from("app_user_connections")
    .select("id")
    .eq("user_id", context.userId)
    .eq("connector_id", CONNECTOR_ID)
    .maybeSingle();
  return !!data;
}

async function resolveTurnosCalendarId(context: SupabaseCtx, connectionAPIKey: string) {
  return resolveCalendarId(context.supabase, context.userId, connectionAPIKey);
}

export const getTurnosCalendarStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (isFigmaDemo()) {
      const connected = await demoCalendarConnected(context as SupabaseCtx);
      const { data: cfg } = await context.supabase
        .from("professional_config")
        .select("google_calendar_id, google_calendar_name")
        .eq("owner_id", context.userId)
        .maybeSingle();
      return {
        connected,
        needsReauth: false,
        calendarId: cfg?.google_calendar_id || "figma-demo-calendar",
        calendarName: cfg?.google_calendar_name || "Turnos",
      };
    }
    const key = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);
    const { data: cfg } = await context.supabase
      .from("professional_config")
      .select("google_calendar_id, google_calendar_name")
      .eq("owner_id", context.userId)
      .maybeSingle();
    let needsReauth = false;
    if (key) {
      try {
        const res = await gcal(key, "/calendar/v3/users/me/calendarList?maxResults=1");
        if (res.status === 401 || res.status === 403) needsReauth = true;
      } catch {
        needsReauth = true;
      }
    }
    return {
      connected: !!key,
      needsReauth,
      calendarId: (cfg?.google_calendar_id as string) || "",
      calendarName: (cfg?.google_calendar_name as string) || "Turnos",
    };
  });

export const ensureTurnosCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ name: z.string().min(1).max(80).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    if (isFigmaDemo()) {
      const calendarId = "figma-demo-calendar";
      await context.supabase
        .from("professional_config")
        .update({
          google_calendar_id: calendarId,
          google_calendar_name: data.name?.trim() || "Turnos",
        })
        .eq("owner_id", context.userId);
      return { calendarId };
    }
    const connectionAPIKey = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);
    if (!connectionAPIKey) throw new Error("Google Calendar no está conectado");
    if (data.name) {
      const { error } = await context.supabase
        .from("professional_config")
        .update({ google_calendar_name: data.name.trim() })
        .eq("owner_id", context.userId);
      if (error) throw new Error(error.message);
    }
    const calendarId = await resolveTurnosCalendarId(context as SupabaseCtx, connectionAPIKey);
    return { calendarId };
  });

export const unlinkTurnosCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("professional_config")
      .update({ google_calendar_id: "" })
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getCalendarConnectionStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (isFigmaDemo()) {
      return { connected: await demoCalendarConnected(context as SupabaseCtx) };
    }
    const key = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);
    return { connected: !!key };
  });

export const startGoogleCalendarConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { origin?: string } | undefined) =>
    z.object({ origin: z.string().url().optional() }).parse(input ?? {}),
  )
  .handler(async ({ context, data }) => {
    if (isFigmaDemo()) {
      const request = getRequest();
      const origin = data.origin ?? (request ? new URL(request.url).origin : "http://localhost");
      return {
        authorizationUrl: `${origin}/oauth/google-calendar/return?code=figma-demo`,
      };
    }
    const clientApiKey = requireClientApiKey();
    const request = getRequest();
    if (!request) throw new Error("OAuth must start from an app request.");
    const returnUrl = new URL(
      "/oauth/google-calendar/return",
      safeOrigin(data.origin) ?? request.url,
    ).toString();

    const connectionAPIKey = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);
    let slot = await getConnectionSlot(context.userId, CONNECTOR_ID);

    const start = (appUserId: string) =>
      authorizeAppUserOAuth({
        gatewayBaseUrl: GATEWAY_BASE_URL,
        connectorId: CONNECTOR_ID,
        appUserId,
        clientAPIKey: clientApiKey,
        returnUrl,
        connectionAPIKey: connectionAPIKey ?? undefined,
        credentialsConfiguration: { scopes: GOOGLE_CALENDAR_SCOPES },
      });

    try {
      const { authorizationUrl } = await start(appUserIdForSlot(context.userId, slot));
      return { authorizationUrl };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // The gateway already has a connection bound to this slot but we have no
      // stored key (a previous consent completed without persisting it).
      // That slot is unusable forever, so move to a fresh one and retry once.
      if (connectionAPIKey || !message.includes("Reconnect requires")) throw error;
      slot = await bumpConnectionSlot(context.userId, CONNECTOR_ID);
      const { authorizationUrl } = await start(appUserIdForSlot(context.userId, slot));
      return { authorizationUrl };
    }
  });

export const completeGoogleCalendarConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ code: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    if (isFigmaDemo()) {
      await context.supabase.from("app_user_connections").upsert(
        {
          user_id: context.userId,
          connector_id: CONNECTOR_ID,
          connection_key_ciphertext: "demo",
        },
        { onConflict: "user_id,connector_id" },
      );
      return { ok: true };
    }
    const { connectionAPIKey, connectorId } = await exchangeAppUserOAuthCode(
      GATEWAY_BASE_URL,
      data.code,
    );
    if (connectorId !== CONNECTOR_ID) {
      throw new Error("OAuth completion returned the wrong connector");
    }
    await saveConnectionKeyForUser(context.userId, connectorId, connectionAPIKey);
    return { ok: true };
  });

export const disconnectGoogleCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (isFigmaDemo()) {
      await context.supabase
        .from("app_user_connections")
        .delete()
        .eq("user_id", context.userId)
        .eq("connector_id", CONNECTOR_ID);
      return { ok: true };
    }
    const connectionAPIKey = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);
    if (connectionAPIKey) {
      await disconnectAppUser({
        gatewayBaseUrl: GATEWAY_BASE_URL,
        connectionAPIKey,
        connectorId: CONNECTOR_ID,
      });
    }
    await deleteConnectionKeyForUser(context.userId, CONNECTOR_ID);
    return { ok: true };
  });

type CalendarEventDto = { id: string; summary: string; start: string; end: string };

async function fetchCalendarEvents(
  context: SupabaseCtx,
  timeMin: string,
  timeMax: string,
): Promise<CalendarEventDto[]> {
  const connectionAPIKey = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);
  if (!connectionAPIKey) return [];

  // Only the dedicated "Turnos" calendar counts; the personal agenda is ignored.
  const turnosId = await resolveTurnosCalendarId(context, connectionAPIKey).catch(() => "");
  const calendars = turnosId ? [turnosId] : [];
  if (calendars.length === 0) return [];

  const items = (
    await Promise.all(
      calendars.map((calId) => listEventsOfCalendar(connectionAPIKey, calId, timeMin, timeMax)),
    )
  ).flat();

  return items
    .filter((event) => event.status !== "cancelled")
    .map((event) => {
      const start = event.start?.dateTime ?? event.start?.date;
      const end = event.end?.dateTime ?? event.end?.date;
      if (!start || !end) return null;
      return { id: event.id, summary: event.summary ?? "", start, end };
    })
    .filter(Boolean) as CalendarEventDto[];
}

export const listGoogleCalendarEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ timeMin: z.string(), timeMax: z.string() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    if (isFigmaDemo()) return [];
    return fetchCalendarEvents(context as SupabaseCtx, data.timeMin, data.timeMax);
  });

export const getCalendarBusyRanges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const raw = z
      .object({
        from: z.string().optional(),
        to: z.string().optional(),
        timeMin: z.string().optional(),
        timeMax: z.string().optional(),
      })
      .parse(input);
    const from = raw.from ?? raw.timeMin;
    const to = raw.to ?? raw.timeMax;
    if (!from || !to) throw new Error("from/to (o timeMin/timeMax) son requeridos");
    return { from, to };
  })
  .handler(async ({ data, context }) => {
    if (isFigmaDemo()) return [];
    const events = await fetchCalendarEvents(context as SupabaseCtx, data.from, data.to);
    return events.map((event) => ({ start: event.start, end: event.end, summary: event.summary }));
  });

export const createCalendarEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        summary: z.string(),
        description: z.string().optional().default(""),
        start: z.string(),
        end: z.string(),
        timeZone: z.string().optional().default(DEFAULT_TIMEZONE),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (isFigmaDemo()) return { eventId: `figma-event-${Date.now()}` };
    const connectionAPIKey = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);
    if (!connectionAPIKey) throw new Error("Google Calendar is not connected");

    const calendarId = await resolveTurnosCalendarId(context as SupabaseCtx, connectionAPIKey);
    const res = await gcal(
      connectionAPIKey,
      `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: data.summary,
          description: data.description,
          start: { dateTime: data.start, timeZone: data.timeZone },
          end: { dateTime: data.end, timeZone: data.timeZone },
          reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 5 }] },
        }),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Google Calendar create failed (${res.status}): ${text.slice(0, 200)}`);
    }
    const body = (await res.json()) as { id: string };
    return { eventId: body.id };
  });

export const updateCalendarEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        eventId: z.string(),
        summary: z.string().optional(),
        description: z.string().optional(),
        start: z.string().optional(),
        end: z.string().optional(),
        timeZone: z.string().optional().default(DEFAULT_TIMEZONE),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (isFigmaDemo()) return { ok: true };
    const connectionAPIKey = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);
    if (!connectionAPIKey) throw new Error("Google Calendar is not connected");

    const payload: Record<string, unknown> = {};
    if (data.summary !== undefined) payload.summary = data.summary;
    if (data.description !== undefined) payload.description = data.description;
    if (data.start !== undefined) payload.start = { dateTime: data.start, timeZone: data.timeZone };
    if (data.end !== undefined) payload.end = { dateTime: data.end, timeZone: data.timeZone };
    payload.reminders = { useDefault: false, overrides: [{ method: "popup", minutes: 5 }] };

    const calendarId = await resolveTurnosCalendarId(context as SupabaseCtx, connectionAPIKey);
    const res = await gcal(
      connectionAPIKey,
      `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${data.eventId}`,
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
    return { ok: true };
  });

export const deleteCalendarEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ eventId: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    if (isFigmaDemo()) return { ok: true };
    const connectionAPIKey = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);
    if (!connectionAPIKey) throw new Error("Google Calendar is not connected");

    const calendarId = await resolveTurnosCalendarId(context as SupabaseCtx, connectionAPIKey);
    const res = await gcal(
      connectionAPIKey,
      `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${data.eventId}`,
      { method: "DELETE" },
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Google Calendar delete failed (${res.status}): ${text.slice(0, 200)}`);
    }
    return { ok: true };
  });

export const getCalendarSyncStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("professional_config")
      .select(
        "calendar_sync_mode, calendar_sync_interval_minutes, calendar_last_sync_at, calendar_last_sync_summary",
      )
      .eq("owner_id", context.userId)
      .maybeSingle();
    return {
      mode: (data?.calendar_sync_mode as string) ?? "app_only",
      intervalMinutes: (data?.calendar_sync_interval_minutes as number) ?? 10,
      lastSyncAt: (data?.calendar_last_sync_at as string | null) ?? null,
      lastSummary: (data?.calendar_last_sync_summary ?? {}) as {
        ok?: boolean;
        eventsRestored?: number;
        eventsCreated?: number;
        eventsMovedBack?: number;
        appointmentsCancelled?: number;
        appointmentsRescheduled?: number;
        conflicts?: string[];
        error?: string;
        at?: string;
      },
    };
  });

export const updateCalendarSyncSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        mode: z.enum(["app_only", "two_way"]),
        intervalMinutes: z.union([
          z.literal(5),
          z.literal(10),
          z.literal(15),
          z.literal(30),
          z.literal(60),
        ]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("professional_config")
      .update({
        calendar_sync_mode: data.mode,
        calendar_sync_interval_minutes: data.intervalMinutes,
      })
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const syncCalendarNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (isFigmaDemo()) {
      const summary = {
        ok: true,
        eventsRestored: 0,
        eventsCreated: 0,
        eventsMovedBack: 0,
        appointmentsCancelled: 0,
        appointmentsRescheduled: 0,
        conflicts: [],
        at: new Date().toISOString(),
      };
      await context.supabase
        .from("professional_config")
        .update({
          calendar_last_sync_at: summary.at,
          calendar_last_sync_summary: summary,
        })
        .eq("owner_id", context.userId);
      return summary;
    }
    return syncOwnerCalendar(context.userId);
  });
