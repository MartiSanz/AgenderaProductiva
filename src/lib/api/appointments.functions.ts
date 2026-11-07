import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from "@/lib/api/calendar.functions";

export const listAppointmentsBetween = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ from: z.string(), to: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("appointments")
      .select("*, patient:patients(id, first_name, last_name, phone, dni, email, birth_date, notes)")
      .eq("owner_id", context.userId)
      .eq("status", "active")
      .gte("start_at", data.from)
      .lte("start_at", data.to)
      .order("start_at");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listUpcomingAppointments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("appointments")
      .select("*, patient:patients(id, first_name, last_name, phone, dni, email, birth_date, notes)")
      .eq("owner_id", context.userId)
      .eq("status", "active")
      .gte("start_at", new Date().toISOString())
      .order("start_at")
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const createSchema = z.object({
  patient_id: z.string().uuid(),
  start_at: z.string(),
  end_at: z.string(),
  notes: z.string().max(500).optional().default(""),
  appointment_type_id: z.string().uuid().nullable().optional(),
  appointment_type_name: z.string().max(120).optional().default(""),
});

export const createAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    const startDate = new Date(data.start_at);
    const dayStart = new Date(startDate); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(startDate); dayEnd.setHours(23, 59, 59, 999);

    const sameDay = await context.supabase
      .from("appointments")
      .select("id")
      .eq("owner_id", context.userId)
      .eq("patient_id", data.patient_id)
      .eq("status", "active")
      .gte("start_at", dayStart.toISOString())
      .lte("start_at", dayEnd.toISOString());
    if (sameDay.error) throw new Error(sameDay.error.message);
    if ((sameDay.data ?? []).length > 0) {
      throw new Error("El paciente ya tiene un turno activo ese día.");
    }

    const cfg = await context.supabase
      .from("professional_config")
      .select("max_active_appointments_per_patient, timezone")
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (cfg.error) throw new Error(cfg.error.message);
    const cap = cfg.data?.max_active_appointments_per_patient ?? 1;
    const timeZone = cfg.data?.timezone ?? "America/Argentina/Buenos_Aires";

    const active = await context.supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", context.userId)
      .eq("patient_id", data.patient_id)
      .eq("status", "active")
      .gte("start_at", new Date().toISOString());
    if (active.error) throw new Error(active.error.message);
    if ((active.count ?? 0) >= cap) {
      throw new Error(`El paciente alcanzó el máximo de ${cap} turno(s) activo(s) permitido(s).`);
    }

    const { data: row, error } = await context.supabase
      .from("appointments")
      .insert({
        ...data,
        appointment_type_id: data.appointment_type_id ?? null,
        appointment_type_name: data.appointment_type_name ?? "",
        owner_id: context.userId,
        calendar_event_id: "",
      } as never)
      .select("*, patient:patients(id, first_name, last_name, phone, dni, email, birth_date, notes)")
      .single();
    if (error) throw new Error(error.message);

    try {
      const patient = row.patient as { first_name: string; last_name: string } | null;
      const typeLabel = data.appointment_type_name ? ` (${data.appointment_type_name})` : "";
      const summary = patient
        ? `Turno: ${patient.first_name} ${patient.last_name}${typeLabel}`
        : `Turno${typeLabel}`;
      const event = await createCalendarEvent({
        data: {
          summary,
          description: data.notes,
          start: data.start_at,
          end: data.end_at,
          timeZone,
        },
      });
      await context.supabase
        .from("appointments")
        .update({ calendar_event_id: event.eventId })
        .eq("id", row.id);
    } catch {
      // Calendar sync failure should not block the appointment creation
    }

    return row;
  });

export const markAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        attendance: z.enum(["pending", "attended", "absent_notified", "absent_no_notice"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("appointments")
      .update({
        attendance: data.attendance,
        attendance_marked_at: data.attendance === "pending" ? null : new Date().toISOString(),
      } as never)
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateAppointmentNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), notes: z.string().max(2000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("appointments")
      .update({ notes: data.notes.trim() } as never)
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const cancelAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("appointments")
      .select("calendar_event_id")
      .eq("id", data.id)
      .eq("owner_id", context.userId)
      .single();

    const { data: deleted, error } = await context.supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", data.id)
      .eq("owner_id", context.userId)
      .eq("status", "active")
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!deleted) throw new Error("El turno no existe o ya fue eliminado.");

    if (existing?.calendar_event_id) {
      try {
        await deleteCalendarEvent({ data: { eventId: existing.calendar_event_id } });
      } catch {
        // Ignore calendar deletion errors
      }
    }
    return { ok: true };
  });

export const rescheduleAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      start_at: z.string(),
      end_at: z.string(),
      notes: z.string().max(500).optional(),
      appointment_type_id: z.string().uuid().nullable().optional(),
      appointment_type_name: z.string().max(120).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("appointments")
      .select("calendar_event_id, patient:patients(first_name, last_name), notes, reschedule_count")
      .eq("id", data.id)
      .eq("owner_id", context.userId)
      .single();

    const { error } = await context.supabase
      .from("appointments")
      .update({
        start_at: data.start_at,
        end_at: data.end_at,
        reschedule_count: ((existing as { reschedule_count?: number } | null)?.reschedule_count ?? 0) + 1,
        ...(data.notes !== undefined ? { notes: data.notes.trim() } : {}),
        ...(data.appointment_type_id !== undefined ? { appointment_type_id: data.appointment_type_id } : {}),
        ...(data.appointment_type_name !== undefined ? { appointment_type_name: data.appointment_type_name } : {}),
      } as never)
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);

    if (existing?.calendar_event_id) {
      try {
        await updateCalendarEvent({
          data: {
            eventId: existing.calendar_event_id,
            start: data.start_at,
            end: data.end_at,
          },
        });
      } catch {
        // Ignore calendar update errors
      }
    } else {
      try {
        const cfg = await context.supabase
          .from("professional_config")
          .select("timezone")
          .eq("owner_id", context.userId)
          .maybeSingle();
        const timeZone = cfg.data?.timezone ?? "America/Argentina/Buenos_Aires";
        const patient = existing?.patient as { first_name: string; last_name: string } | null;
        const summary = patient ? `Turno: ${patient.first_name} ${patient.last_name}` : "Turno";
        const event = await createCalendarEvent({
          data: {
            summary,
            description: (existing as { notes?: string } | null)?.notes ?? "",
            start: data.start_at,
            end: data.end_at,
            timeZone,
          },
        });
        await context.supabase
          .from("appointments")
          .update({ calendar_event_id: event.eventId })
          .eq("id", data.id)
          .eq("owner_id", context.userId);
      } catch {
        // Ignore calendar sync errors
      }
    }
    return { ok: true };
  });

export const getPatientLastVisit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ patient_id: z.string().uuid(), before: z.string() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("appointments")
      .select("start_at")
      .eq("owner_id", context.userId)
      .eq("patient_id", data.patient_id)
      .lt("start_at", data.before)
      .order("start_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { last_visit: row?.start_at ?? null };
  });
