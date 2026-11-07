import { computeAvailableSlots, formatTime } from "@/lib/domain/availability";
import type { ApptLite, BotDeps, DayBlock } from "@/lib/domain/botEngine";

const LOOKAHEAD_DAYS = 21;
const MAX_DAYS = 3;
const MAX_SLOTS_PER_DAY = 12;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function calendarKey(ownerId: string) {
  const { CONNECTOR_ID } = await import("@/server/googleCalendar.server");
  const { getConnectionKeyForUser } = await import("@/server/appUserConnections.server");
  return { key: await getConnectionKeyForUser(ownerId, CONNECTOR_ID), CONNECTOR_ID };
}

export async function busyRanges(db: any, ownerId: string, from: string, to: string) {
  try {
    const { key } = await calendarKey(ownerId);
    if (!key) return [];
    const { resolveTurnosCalendarId, listEventsOfCalendar } = await import("@/server/googleCalendar.server");
    const calendarId = await resolveTurnosCalendarId(db, ownerId, key);
    if (!calendarId) return [];
    const items = await listEventsOfCalendar(key, calendarId, from, to);
    return items
      .filter((e) => e.status !== "cancelled")
      .map((e) => ({ start: e.start?.dateTime ?? e.start?.date ?? "", end: e.end?.dateTime ?? e.end?.date ?? "" }))
      .filter((e) => e.start && e.end);
  } catch (error) {
    console.error("bot busyRanges failed", error);
    return [];
  }
}

async function pushCalendarEvent(
  db: any,
  ownerId: string,
  appointmentId: string,
  summary: string,
  startISO: string,
  endISO: string,
  timeZone: string,
) {
  try {
    const { key } = await calendarKey(ownerId);
    if (!key) return;
    const { resolveTurnosCalendarId, insertEvent, kindProps } = await import("@/server/googleCalendar.server");
    const calendarId = await resolveTurnosCalendarId(db, ownerId, key);
    const eventId = await insertEvent(key, calendarId, {
      summary,
      start: { dateTime: startISO, timeZone },
      end: { dateTime: endISO, timeZone },
      ...kindProps("appointment", { appointment_id: appointmentId }),
    });
    await db.from("appointments").update({ calendar_event_id: eventId }).eq("id", appointmentId);
  } catch (error) {
    console.error("bot calendar create failed", error);
  }
}

/**
 * Server-side implementation of the bot's data actions for one professional
 * and one patient phone number. Used by the WhatsApp webhook and by the
 * in-app simulator so both share exactly the same behaviour.
 */
export async function buildBotDeps(ownerId: string, phone: string): Promise<BotDeps> {
  const db = await admin();

  const { data: config } = await db
    .from("professional_config")
    .select("*")
    .eq("owner_id", ownerId)
    .maybeSingle();

  const timeZone = config?.timezone ?? "America/Argentina/Buenos_Aires";

  const { hasFeature } = await import("@/server/entitlements.server");
  const canSelfBook = await hasFeature(ownerId, "patient_self_booking");

  async function upcomingAll(): Promise<ApptLite[]> {
    const { data } = await db
      .from("appointments")
      .select("id, start_at, end_at, patient:patients(id, first_name, last_name, dni, phone)")
      .eq("owner_id", ownerId)
      .eq("status", "active")
      .gte("start_at", new Date().toISOString())
      .order("start_at")
      .limit(50);
    return (data ?? []) as ApptLite[];
  }

  return {
    config,
    canSelfBook,

    async availableDays(): Promise<DayBlock[]> {
      if (!config) return [];
      const from = new Date();
      from.setHours(0, 0, 0, 0);
      const to = new Date(from);
      to.setDate(to.getDate() + LOOKAHEAD_DAYS);
      to.setHours(23, 59, 59, 999);

      const [schedule, timeOff, appts, calendarBusy, dated] = await Promise.all([
        db.from("weekly_schedule").select("*").eq("owner_id", ownerId),
        db.from("time_off").select("*").eq("owner_id", ownerId),
        db
          .from("appointments")
          .select("*")
          .eq("owner_id", ownerId)
          .eq("status", "active")
          .gte("start_at", from.toISOString())
          .lte("start_at", to.toISOString()),
        busyRanges(db, ownerId, from.toISOString(), to.toISOString()),
        db.from("schedule_date_blocks").select("*").eq("owner_id", ownerId),
      ]);

      const { dateBlocksAsBands } = await import("@/lib/domain/dateBlocks");
      const normalized = [
        ...(schedule.data ?? []).map((r: any) => ({
          ...r,
          start_time: String(r.start_time).slice(0, 5),
          end_time: String(r.end_time).slice(0, 5),
        })),
        ...dateBlocksAsBands((dated as any).data ?? []),
      ];

      const days: DayBlock[] = [];
      for (let i = 0; i < LOOKAHEAD_DAYS && days.length < MAX_DAYS; i++) {
        const d = new Date(from);
        d.setDate(d.getDate() + i);
        d.setHours(12, 0, 0, 0); // midday anchor so tz conversion keeps the same calendar day
        const slots = computeAvailableSlots(
          d,
          {
            appointment_duration_minutes: config.appointment_duration_minutes,
            non_working_days: config.non_working_days ?? [],
            timezone: (config as any).timezone || "America/Argentina/Buenos_Aires",
          },
          normalized as any,
          (timeOff.data ?? []) as any,
          (appts.data ?? []) as any,
          calendarBusy as any,
        );
        if (slots.length > 0) {
          days.push({
            date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
            slots: slots.slice(0, MAX_SLOTS_PER_DAY).map((s) => ({
              startISO: s.start.toISOString(),
              endISO: s.end.toISOString(),
              label: formatTime(s.start, (config as any).timezone || "America/Argentina/Buenos_Aires"),
            })),
          });
        }
      }
      return days;
    },

    async checkAllowed(dni: string) {
      const mode = config?.booking_access_mode ?? "open";
      if (mode !== "whitelist") return { allowed: true, mode };
      const { data } = await db
        .from("patients")
        .select("id, is_allowed")
        .eq("owner_id", ownerId)
        .eq("dni", dni)
        .maybeSingle();
      return { allowed: !!data?.is_allowed, mode };
    },

    async upcomingForPatient(dni: string) {
      const all = await upcomingAll();
      return all.filter((a) => a.patient?.dni === dni);
    },

    async findPatient(dni: string) {
      const { data } = await db
        .from("patients")
        .select("id, first_name")
        .eq("owner_id", ownerId)
        .eq("dni", dni)
        .maybeSingle();
      return data ?? null;
    },

    async createPatient(p) {
      const { data, error } = await db
        .from("patients")
        .insert({ ...p, phone, owner_id: ownerId, is_allowed: false })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return data;
    },

    async createAppointment(patientId, startISO, endISO) {
      const start = new Date(startISO);
      const dayStart = new Date(start);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(start);
      dayEnd.setHours(23, 59, 59, 999);

      const sameDay = await db
        .from("appointments")
        .select("id")
        .eq("owner_id", ownerId)
        .eq("patient_id", patientId)
        .eq("status", "active")
        .gte("start_at", dayStart.toISOString())
        .lte("start_at", dayEnd.toISOString());
      if ((sameDay.data ?? []).length > 0) throw new Error("Ya tenés un turno activo ese día.");

      const cap = config?.max_active_appointments_per_patient ?? 1;
      const active = await db
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", ownerId)
        .eq("patient_id", patientId)
        .eq("status", "active")
        .gte("start_at", new Date().toISOString());
      if ((active.count ?? 0) >= cap) {
        throw new Error(`Alcanzaste el máximo de ${cap} turno(s) activo(s) permitido(s).`);
      }

      const { data: row, error } = await db
        .from("appointments")
        .insert({
          owner_id: ownerId,
          patient_id: patientId,
          start_at: startISO,
          end_at: endISO,
          notes: "",
          calendar_event_id: "",
        })
        .select("id, patient:patients(first_name, last_name)")
        .single();
      if (error) throw new Error(error.message);

      const patient = row.patient as { first_name: string; last_name: string } | null;
      await pushCalendarEvent(
        db,
        ownerId,
        row.id,
        patient ? `Turno: ${patient.first_name} ${patient.last_name}` : "Turno",
        startISO,
        endISO,
        timeZone,
      );
    },

    async cancelAppointment(id) {
      const { data: existing } = await db
        .from("appointments")
        .select("calendar_event_id")
        .eq("id", id)
        .eq("owner_id", ownerId)
        .maybeSingle();
      const { error } = await db.from("appointments").delete().eq("id", id).eq("owner_id", ownerId);
      if (error) throw new Error(error.message);
      if (existing?.calendar_event_id) {
        try {
          const { key } = await calendarKey(ownerId);
          if (key) {
            const { resolveTurnosCalendarId, removeEvent } = await import("@/server/googleCalendar.server");
            const calendarId = await resolveTurnosCalendarId(db, ownerId, key);
            await removeEvent(key, calendarId, existing.calendar_event_id);
          }
        } catch (calendarError) {
          console.error("bot calendar delete failed", calendarError);
        }
      }
    },

    async rescheduleAppointment(id, startISO, endISO) {
      const { data: existing } = await db
        .from("appointments")
        .select("calendar_event_id")
        .eq("id", id)
        .eq("owner_id", ownerId)
        .maybeSingle();
      const { error } = await db
        .from("appointments")
        .update({ start_at: startISO, end_at: endISO, confirmed_at: null, reminder_sent_at: null, confirm_token: null, confirm_token_expires_at: null })
        .eq("id", id)
        .eq("owner_id", ownerId);
      if (error) throw new Error(error.message);
      if (existing?.calendar_event_id) {
        try {
          const { key } = await calendarKey(ownerId);
          if (key) {
            const { resolveTurnosCalendarId, patchEvent } = await import("@/server/googleCalendar.server");
            const calendarId = await resolveTurnosCalendarId(db, ownerId, key);
            await patchEvent(key, calendarId, existing.calendar_event_id, {
              start: { dateTime: startISO, timeZone },
              end: { dateTime: endISO, timeZone },
            });
          }
        } catch (calendarError) {
          console.error("bot calendar patch failed", calendarError);
        }
      }
    },

    async confirmAppointment(id) {
      await db
        .from("appointments")
        .update({ confirmed_at: new Date().toISOString() })
        .eq("id", id)
        .eq("owner_id", ownerId);
    },
  };
}