import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { toTitleCase } from "@/lib/names";
import { normalizeArPhone } from "@/lib/phone";

const identitySchema = z.object({
  first_name: z.string().trim().min(2, "Ingresá tu nombre.").max(60).transform(toTitleCase),
  last_name: z.string().trim().min(2, "Ingresá tu apellido.").max(60).transform(toTitleCase),
  phone: z.string().trim().min(6, "Ingresá tu teléfono.").max(30).transform(normalizeArPhone),
});
const ownerSchema = z.string().uuid();

export const listProfessionals = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({ q: z.string().max(80).default(""), specialty: z.string().max(80).default("") }).parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    const { listProfessionalsRaw } = await import("@/server/portal.server");
    const rows = await listProfessionalsRaw(data.q, data.specialty);
    return rows.map((p: any) => ({
      owner_id: p.owner_id,
      display_name: p.display_name,
      specialty: p.specialty ?? "",
      address: p.address ?? "",
    }));
  });

export const listSpecialties = createServerFn({ method: "GET" }).handler(async () => {
  const { listProfessionalsRaw } = await import("@/server/portal.server");
  const rows = await listProfessionalsRaw("", "");
  return Array.from(new Set(rows.map((r: any) => (r.specialty ?? "").trim()).filter(Boolean))).sort();
});

export const getProfessional = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ ownerId: ownerSchema }).parse(d))
  .handler(async ({ data }) => {
    const { getProfessionalRaw } = await import("@/server/portal.server");
    const { config, locations, schedule } = await getProfessionalRaw(data.ownerId);
    return {
      owner_id: config.owner_id,
      display_name: config.display_name,
      specialty: config.specialty ?? "",
      address: config.address ?? "",
      maps_url: config.maps_url ?? "",
      phone: config.phone ?? "",
      timezone: config.timezone ?? "",
      locations,
      schedule: schedule.map((b: any) => ({
        day_of_week: b.day_of_week,
        start_time: String(b.start_time ?? "").slice(0, 5),
        end_time: String(b.end_time ?? "").slice(0, 5),
        location_id: b.location_id ?? null,
        start_date: b.start_date ?? null,
        end_date: b.end_date ?? null,
      })),
    };
  });

export const portalAppointmentTypes = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ ownerId: ownerSchema }).parse(d))
  .handler(async ({ data }) => {
    const { listAppointmentTypesRaw } = await import("@/server/portal.server");
    return await listAppointmentTypesRaw(data.ownerId);
  });

export const portalAvailability = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z
      .object({
        ownerId: ownerSchema,
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        count: z.number().int().min(1).max(6).default(3),
        typeId: z.string().uuid().optional(),
        durationMinutes: z.number().int().min(5).max(480).optional(),
        locationId: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { availabilityFrom, listAppointmentTypesRaw } = await import("@/server/portal.server");
    let duration = data.durationMinutes;
    if (data.typeId) {
      const types = await listAppointmentTypesRaw(data.ownerId);
      duration = types.find((t) => t.id === data.typeId)?.duration_minutes ?? duration;
    }
    return await availabilityFrom(data.ownerId, data.from, data.count, duration, data.locationId);
  });

export const portalLookupPatient = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ ownerId: ownerSchema, who: identitySchema }).parse(d))
  .handler(async ({ data }) => {
    const { findPatientByIdentity, upcomingForPatientId, getProfessionalRaw } = await import("@/server/portal.server");
    const patient = await findPatientByIdentity(data.ownerId, data.who);
    const { config } = await getProfessionalRaw(data.ownerId);
    if (!patient) {
      // Whitelist mode: an unknown DNI can never book, so block here instead of
      // walking the patient through registration and failing at the last step.
      if (config.booking_access_mode === "whitelist") {
        return { found: false as const, blocked: true, patient: null, appointments: [], maxActive: 0 };
      }
      return { found: false as const, blocked: false, patient: null, appointments: [], maxActive: 0 };
    }
    if (patient.is_blocked) {
      return { found: true as const, blocked: true, absences: true, patient: null, appointments: [], maxActive: 0 };
    }
    if (config.booking_access_mode === "whitelist" && !patient.is_allowed) {
      return { found: true as const, blocked: true, patient: null, appointments: [], maxActive: 0 };
    }
    const appointments = await upcomingForPatientId(data.ownerId, patient.id);
    return {
      found: true as const,
      blocked: false,
      patient: { id: patient.id, first_name: patient.first_name, last_name: patient.last_name },
      appointments,
      maxActive: config.max_active_appointments_per_patient ?? 1,
    };
  });

const newPatientSchema = z.object({
  dni: z.string().trim().max(20).optional().default(""),
  email: z.string().trim().email("Ingresá un email válido.").max(120).or(z.literal("")).default(""),
});

export const portalBook = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        ownerId: ownerSchema,
        who: identitySchema,
        patient: newPatientSchema.optional(),
        startISO: z.string().datetime(),
        endISO: z.string().datetime(),
        typeId: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { db, findPatientByIdentity, assertSlotFree, upcomingForPatientId, getProfessionalRaw, listAppointmentTypesRaw } = await import(
      "@/server/portal.server"
    );
    const client = await db();
    const { config } = await getProfessionalRaw(data.ownerId);

    let patient = await findPatientByIdentity(data.ownerId, data.who);
    if (!patient) {
      if (config.booking_access_mode === "whitelist") {
        throw new Error("Este profesional solo acepta turnos de pacientes habilitados. Contactalo directamente.");
      }
      const { data: row, error } = await client
        .from("patients")
        .insert({
          owner_id: data.ownerId,
          dni: data.patient?.dni ?? "",
          first_name: data.who.first_name,
          last_name: data.who.last_name,
          phone: data.who.phone,
          email: data.patient?.email ?? "",
          is_allowed: false,
        })
        .select("id, first_name, last_name")
        .single();
      if (error) throw new Error(error.message);
      patient = row;
    } else if (patient.is_blocked) {
      throw new Error("No podés reservar turnos online por ausencias sin aviso. Contactá al profesional.");
    } else if (config.booking_access_mode === "whitelist" && !patient.is_allowed) {
      throw new Error("Este profesional solo acepta turnos de pacientes habilitados. Contactalo directamente.");
    }

    const cap = config.max_active_appointments_per_patient ?? 1;
    const active = await upcomingForPatientId(data.ownerId, patient.id);
    if (active.length >= cap) {
      throw new Error(`Ya tenés ${active.length} turno(s) activo(s). El máximo permitido es ${cap}.`);
    }
    if (active.some((a) => a.start_at.slice(0, 10) === data.startISO.slice(0, 10))) {
      throw new Error("Ya tenés un turno ese día.");
    }

    let endISO = data.endISO;
    let typeRow: { id: string; name: string; duration_minutes: number } | undefined;
    if (data.typeId) {
      const types = await listAppointmentTypesRaw(data.ownerId);
      typeRow = types.find((t) => t.id === data.typeId);
      if (!typeRow) throw new Error("Ese tipo de turno ya no está disponible.");
      endISO = new Date(new Date(data.startISO).getTime() + typeRow.duration_minutes * 60000).toISOString();
    }

    await assertSlotFree(data.ownerId, data.startISO, endISO);
    const { error } = await client.from("appointments").insert({
      owner_id: data.ownerId,
      patient_id: patient.id,
      start_at: data.startISO,
      end_at: endISO,
      appointment_type_id: typeRow?.id ?? null,
      appointment_type_name: typeRow?.name ?? "",
      notes: "",
      calendar_event_id: "",
    });
    if (error) throw new Error(error.message);
    return { ok: true, startISO: data.startISO };
  });

export const portalCancel = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ ownerId: ownerSchema, who: identitySchema, appointmentId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { db, findPatientByIdentity } = await import("@/server/portal.server");
    const client = await db();
    const patient = await findPatientByIdentity(data.ownerId, data.who);
    if (!patient) throw new Error("No encontramos tus datos.");
    const { data: before } = await client
      .from("appointments")
      .select("start_at, appointment_type_name")
      .eq("id", data.appointmentId)
      .eq("owner_id", data.ownerId)
      .eq("patient_id", patient.id)
      .maybeSingle();
    const { error } = await client
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", data.appointmentId)
      .eq("owner_id", data.ownerId)
      .eq("patient_id", patient.id);
    if (error) throw new Error(error.message);
    if (before) {
      try {
        const { notifyAppointmentChangePush } = await import("@/server/webPush.server");
        await notifyAppointmentChangePush({
          kind: "cancel",
          ownerId: data.ownerId,
          patientName: `${patient.first_name ?? ""} ${patient.last_name ?? ""}`.trim(),
          typeName: before.appointment_type_name,
          oldStart: before.start_at,
        });
      } catch (e) {
        console.error("cancel push failed", e);
      }
    }
    return { ok: true };
  });

export const portalReschedule = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        ownerId: ownerSchema,
        who: identitySchema,
        appointmentId: z.string().uuid(),
        startISO: z.string().datetime(),
        endISO: z.string().datetime(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { db, findPatientByIdentity, assertSlotFree } = await import("@/server/portal.server");
    const client = await db();
    const patient = await findPatientByIdentity(data.ownerId, data.who);
    if (!patient) throw new Error("No encontramos tus datos.");
    await assertSlotFree(data.ownerId, data.startISO, data.endISO, data.appointmentId);
    const { data: before } = await client
      .from("appointments")
      .select("start_at, appointment_type_name")
      .eq("id", data.appointmentId)
      .eq("owner_id", data.ownerId)
      .eq("patient_id", patient.id)
      .maybeSingle();
    const { error } = await client
      .from("appointments")
      .update({ start_at: data.startISO, end_at: data.endISO, confirmed_at: null, reminder_sent_at: null, confirm_token: null, confirm_token_expires_at: null })
      .eq("id", data.appointmentId)
      .eq("owner_id", data.ownerId)
      .eq("patient_id", patient.id);
    if (error) throw new Error(error.message);
    if (before) {
      try {
        const { notifyAppointmentChangePush } = await import("@/server/webPush.server");
        await notifyAppointmentChangePush({
          kind: "reschedule",
          ownerId: data.ownerId,
          patientName: `${patient.first_name ?? ""} ${patient.last_name ?? ""}`.trim(),
          typeName: before.appointment_type_name,
          oldStart: before.start_at,
          newStart: data.startISO,
        });
      } catch (e) {
        console.error("reschedule push failed", e);
      }
    }
    return { ok: true, startISO: data.startISO };
  });
