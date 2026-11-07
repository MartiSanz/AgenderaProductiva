/**
 * Background reconciliation between the app's appointments and the dedicated
 * Google Calendar ("Turnos") of each professional.
 *
 * Two modes (professional_config.calendar_sync_mode):
 *  - app_only: the app is the source of truth. Manual changes in Google are undone.
 *  - two_way : Google wins. Deleted events cancel the appointment, moved events
 *              reschedule it when the new slot is valid.
 */
import {
  CONNECTOR_ID,
  DEFAULT_TIMEZONE,
  listEventsOfCalendar,
  insertEvent,
  insertAllDayEvent,
  patchEvent,
  getEvent,
  removeEvent,
  resolveTurnosCalendarId,
  eventKind,
  kindProps,
  type GEvent,
} from "@/server/googleCalendar.server";
import { getConnectionKeyForUser } from "@/server/appUserConnections.server";

export type SyncSummary = {
  ok: boolean;
  eventsRestored: number;
  eventsCreated: number;
  eventsMovedBack: number;
  appointmentsCancelled: number;
  appointmentsRescheduled: number;
  timeOffCreated: number;
  timeOffRestored: number;
  conflicts: string[];
  error?: string;
  at: string;
};

const WINDOW_DAYS = 60;

function localParts(iso: string, timeZone: string) {
  const d = new Date(iso);
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return {
    ymd: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(hour) * 60 + Number(parts.minute),
    dow: weekdayMap[parts.weekday as string] ?? 0,
  };
}

function hmToMinutes(hm: string) {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + (m || 0);
}

function eventStart(e: GEvent) {
  return e.start?.dateTime ?? (e.start?.date ? `${e.start.date}T00:00:00Z` : null);
}
function eventEnd(e: GEvent) {
  return e.end?.dateTime ?? (e.end?.date ? `${e.end.date}T00:00:00Z` : null);
}

function sameInstant(a: string | null, b: string | null) {
  if (!a || !b) return false;
  return new Date(a).getTime() === new Date(b).getTime();
}

export async function syncOwnerCalendar(ownerId: string): Promise<SyncSummary> {
  const summary: SyncSummary = {
    ok: true,
    eventsRestored: 0,
    eventsCreated: 0,
    eventsMovedBack: 0,
    appointmentsCancelled: 0,
    appointmentsRescheduled: 0,
    timeOffCreated: 0,
    timeOffRestored: 0,
    conflicts: [],
    at: new Date().toISOString(),
  };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const connectionAPIKey = await getConnectionKeyForUser(ownerId, CONNECTOR_ID);
  if (!connectionAPIKey) {
    return { ...summary, ok: false, error: "Google Calendar no está conectado" };
  }

  const { data: cfg } = await supabaseAdmin
    .from("professional_config")
    .select("timezone, calendar_sync_mode, non_working_days")
    .eq("owner_id", ownerId)
    .maybeSingle();

  const timeZone = cfg?.timezone || DEFAULT_TIMEZONE;
  const mode = (cfg?.calendar_sync_mode as string) || "app_only";
  const nonWorking: number[] = (cfg?.non_working_days as number[]) ?? [];

  const calendarId = await resolveTurnosCalendarId(supabaseAdmin as any, ownerId, connectionAPIKey);

  const now = new Date();
  const timeMin = now.toISOString();
  const timeMax = new Date(now.getTime() + WINDOW_DAYS * 86_400_000).toISOString();

  const { data: appointments, error: apptErr } = await supabaseAdmin
    .from("appointments")
    .select("id, start_at, end_at, notes, calendar_event_id, patient:patients(first_name, last_name)")
    .eq("owner_id", ownerId)
    .eq("status", "active")
    .gte("start_at", timeMin)
    .lte("start_at", timeMax);
  if (apptErr) return { ...summary, ok: false, error: apptErr.message };

  const events = await listEventsOfCalendar(connectionAPIKey, calendarId, timeMin, timeMax);
  const byId = new Map<string, GEvent>();
  for (const e of events) {
    if (e.status !== "cancelled") byId.set(e.id, e);
  }

  // Data needed to validate moved events in two_way mode.
  const [{ data: schedule }, { data: timeOff }] = await Promise.all([
    supabaseAdmin.from("weekly_schedule").select("day_of_week, start_time, end_time").eq("owner_id", ownerId),
    supabaseAdmin.from("time_off").select("start_date, end_date, start_time").eq("owner_id", ownerId),
  ]);

  const validateSlot = (
    startIso: string,
    endIso: string,
    ignoreAppointmentId: string,
  ): string | null => {
    const s = localParts(startIso, timeZone);
    const e = localParts(endIso, timeZone);
    if (nonWorking.includes(s.dow)) return "cae en un día no laborable";
    if ((timeOff ?? []).some((t: any) => !t.start_time && s.ymd >= t.start_date && s.ymd <= t.end_date))
      return "cae dentro de un período de licencia";
    const bands = (schedule ?? []).filter((b: any) => b.day_of_week === s.dow);
    const fits = bands.some(
      (b: any) => s.minutes >= hmToMinutes(b.start_time) && e.minutes <= hmToMinutes(b.end_time),
    );
    if (!fits) return "queda fuera de tus horarios de atención";
    const st = new Date(startIso).getTime();
    const en = new Date(endIso).getTime();
    const clash = (appointments ?? []).some(
      (a: any) =>
        a.id !== ignoreAppointmentId &&
        new Date(a.start_at).getTime() < en &&
        new Date(a.end_at).getTime() > st,
    );
    if (clash) return "se superpone con otro turno";
    return null;
  };

  for (const appt of (appointments ?? []) as any[]) {
    const patient = appt.patient as { first_name: string; last_name: string } | null;
    const title = patient ? `Turno: ${patient.first_name} ${patient.last_name}` : "Turno";
    const eventId: string = appt.calendar_event_id || "";
    let event = eventId ? byId.get(eventId) : undefined;

    // 1. Appointment without an event in the synced window.
    if (!event) {
      if (eventId && mode === "two_way") {
        // The event may simply have been moved outside the 60-day window.
        // Only treat it as a deletion when Google confirms it no longer exists.
        let stillExists: GEvent | null = null;
        try {
          stillExists = await getEvent(connectionAPIKey, calendarId, eventId);
        } catch (err) {
          summary.conflicts.push(
            `No se pudo verificar el evento de ${title} en Google, se conservó el turno: ${err instanceof Error ? err.message : String(err)}`,
          );
          continue;
        }
        if (stillExists) {
          // Moved out of the window: keep the appointment and flag it.
          const movedTo = eventStart(stillExists);
          if (movedTo && !sameInstant(movedTo, appt.start_at)) {
            summary.conflicts.push(
              `${title}: el evento se movió fuera de los próximos ${WINDOW_DAYS} días en Google; el turno se mantiene sin cambios.`,
            );
          }
          continue;
        }
        const { error } = await supabaseAdmin.from("appointments").delete().eq("id", appt.id);
        if (!error) summary.appointmentsCancelled += 1;
        continue;
      }
      try {
        const newId = await insertEvent(connectionAPIKey, calendarId, {
          summary: title,
          description: appt.notes ?? "",
          start: { dateTime: appt.start_at, timeZone },
          end: { dateTime: appt.end_at, timeZone },
          ...kindProps("appointment"),
        });
        await supabaseAdmin
          .from("appointments")
          .update({ calendar_event_id: newId })
          .eq("id", appt.id);
        if (eventId) summary.eventsRestored += 1;
        else summary.eventsCreated += 1;
      } catch (err) {
        summary.conflicts.push(
          `No se pudo crear el evento de ${title}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      continue;
    }

    // 2. Event exists — compare times.
    const gStart = eventStart(event);
    const gEnd = eventEnd(event);
    const moved = !sameInstant(gStart, appt.start_at) || !sameInstant(gEnd, appt.end_at);
    if (!moved) continue;

    if (mode === "app_only") {
      try {
        await patchEvent(connectionAPIKey, calendarId, event.id, {
          summary: title,
          start: { dateTime: appt.start_at, timeZone },
          end: { dateTime: appt.end_at, timeZone },
        });
        summary.eventsMovedBack += 1;
      } catch (err) {
        summary.conflicts.push(
          `No se pudo restaurar el evento de ${title}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      continue;
    }

    // two_way: Google wins when the new slot is valid.
    if (!gStart || !gEnd) continue;
    const problem = validateSlot(gStart, gEnd, appt.id);
    if (problem) {
      summary.conflicts.push(`${title}: el nuevo horario ${problem}, se restauró el original.`);
      try {
        await patchEvent(connectionAPIKey, calendarId, event.id, {
          start: { dateTime: appt.start_at, timeZone },
          end: { dateTime: appt.end_at, timeZone },
        });
        summary.eventsMovedBack += 1;
      } catch {
        // ignore
      }
      continue;
    }
    const { error } = await supabaseAdmin
      .from("appointments")
      .update({ start_at: gStart, end_at: gEnd })
      .eq("id", appt.id);
    if (!error) {
      appt.start_at = gStart;
      appt.end_at = gEnd;
      summary.appointmentsRescheduled += 1;
    }
  }

  // --- Licencias / vacaciones: la app las publica como eventos de día completo.
  try {
    const todayYmd = new Date().toISOString().slice(0, 10);
    const maxYmd = new Date(now.getTime() + WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);
    const { data: periods } = await supabaseAdmin
      .from("time_off")
      .select("id, start_date, end_date, reason, calendar_event_id")
      .eq("owner_id", ownerId)
      .is("start_time", null)
      .gte("end_date", todayYmd)
      .lte("start_date", maxYmd);

    const validIds = new Set<string>();
    for (const period of (periods ?? []) as any[]) {
      const existing = period.calendar_event_id ? byId.get(period.calendar_event_id) : undefined;
      if (existing) {
        validIds.add(period.calendar_event_id);
        continue;
      }
      try {
        const newId = await insertAllDayEvent(connectionAPIKey, calendarId, {
          summary: period.reason ? `Licencia: ${period.reason}` : "Licencia",
          startDate: period.start_date,
          endDate: period.end_date,
          kind: "time_off",
          props: { time_off_id: period.id },
        });
        validIds.add(newId);
        await supabaseAdmin.from("time_off").update({ calendar_event_id: newId }).eq("id", period.id);
        if (period.calendar_event_id) summary.timeOffRestored += 1;
        else summary.timeOffCreated += 1;
      } catch (err) {
        summary.conflicts.push(
          `No se pudo publicar la licencia del ${period.start_date}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // Eventos de licencia creados por la app que ya no tienen período asociado.
    for (const event of byId.values()) {
      if (eventKind(event) !== "time_off") continue;
      if (validIds.has(event.id)) continue;
      await removeEvent(connectionAPIKey, calendarId, event.id).catch(() => {});
    }
  } catch (err) {
    summary.conflicts.push(
      `No se pudieron sincronizar las licencias: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  await supabaseAdmin
    .from("professional_config")
    .update({ calendar_last_sync_at: summary.at, calendar_last_sync_summary: summary as any })
    .eq("owner_id", ownerId);

  return summary;
}

/** Runs the sync for every professional whose interval already elapsed. */
export async function syncDueOwners(): Promise<{ processed: number; results: Record<string, string> }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: connections } = await supabaseAdmin
    .from("app_user_connections")
    .select("user_id")
    .eq("connector_id", CONNECTOR_ID);

  const results: Record<string, string> = {};
  let processed = 0;
  for (const conn of (connections ?? []) as any[]) {
    const { data: cfg } = await supabaseAdmin
      .from("professional_config")
      .select("calendar_sync_interval_minutes, calendar_last_sync_at")
      .eq("owner_id", conn.user_id)
      .maybeSingle();
    const interval = (cfg?.calendar_sync_interval_minutes as number) ?? 10;
    const last = cfg?.calendar_last_sync_at ? new Date(cfg.calendar_last_sync_at).getTime() : 0;
    if (Date.now() - last < interval * 60_000) continue;
    processed += 1;
    try {
      const summary = await syncOwnerCalendar(conn.user_id);
      results[conn.user_id] = summary.ok ? "ok" : (summary.error ?? "error");
    } catch (err) {
      results[conn.user_id] = err instanceof Error ? err.message : String(err);
    }
  }
  return { processed, results };
}
