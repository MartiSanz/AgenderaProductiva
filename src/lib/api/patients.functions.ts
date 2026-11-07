import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { toTitleCase } from "@/lib/names";
import { normalizeArPhone } from "@/lib/phone";
import { matchPatient, type PatientIdentity } from "@/lib/patientIdentity";

export const listActivePatients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("patients")
      .select("*, appointments:appointments!inner(id, start_at, status)")
      .eq("owner_id", context.userId)
      .eq("appointments.status", "active")
      .gte("appointments.start_at", new Date().toISOString())
      .order("last_name").order("first_name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const upsertSchema = z.object({
  first_name: z.string().trim().min(1).transform(toTitleCase),
  last_name: z.string().trim().min(1).transform(toTitleCase),
  dni: z.string().trim().max(20).optional().default(""),
  email: z.string().email().or(z.literal("")).default(""),
  phone: z.string().trim().min(5).transform(normalizeArPhone),
  channel: z.enum(["app", "whatsapp"]).optional().default("app"),
});

/** Busca al paciente por la regla única: teléfono + nombre + apellido. */
async function findByIdentity(supabase: any, ownerId: string, who: PatientIdentity, excludeId?: string) {
  const { data, error } = await supabase.from("patients").select("*").eq("owner_id", ownerId).eq("phone", who.phone);
  if (error) throw new Error(error.message);
  const rows = ((data ?? []) as any[]).filter((r) => r.id !== excludeId);
  return matchPatient(rows, who);
}

export const findOrCreatePatient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { channel, ...patient } = data;
    const existing = await findByIdentity(supabase, userId, patient);
    if (existing || channel === "whatsapp") {
      if (channel === "whatsapp" && !existing?.is_allowed) {
        const cfg = await supabase
          .from("professional_config")
          .select("booking_access_mode")
          .eq("owner_id", userId)
          .maybeSingle();
        if (cfg.data?.booking_access_mode === "whitelist") {
          throw new Error("Este paciente no está habilitado para reservar turnos.");
        }
      }
      if (existing) {
        // Completa el DNI o email si se informaron y no estaban cargados.
        const patch: { dni?: string; email?: string } = {};
        if (patient.dni && !existing.dni) patch.dni = patient.dni;
        if (patient.email && !existing.email) patch.email = patient.email;
        if (Object.keys(patch).length) {
          const upd = await supabase.from("patients").update(patch).eq("id", existing.id).select().single();
          if (!upd.error) return upd.data;
        }
        return existing;
      }
    }
    const ins = await supabase
      .from("patients")
      .insert({ ...patient, owner_id: userId, is_allowed: channel === "app" })
      .select()
      .single();
    if (ins.error) {
      const retry = await findByIdentity(supabase, userId, patient);
      if (retry) return retry;
      throw new Error(ins.error.message);
    }
    return ins.data;
  });

export const getPatientByPhone = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ phone: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("patients")
      .select("*")
      .eq("owner_id", context.userId)
      .eq("phone", data.phone)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

/* ---------- Whitelist de pacientes ---------- */

export const listMyPatients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("patients")
      .select("*")
      .eq("owner_id", context.userId)
      .order("last_name").order("first_name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const whitelistSchema = z.object({
  first_name: z.string().trim().min(1).max(80).transform(toTitleCase),
  last_name: z.string().trim().min(1).max(80).transform(toTitleCase),
  dni: z.string().trim().max(20).optional().default(""),
  phone: z.string().trim().min(5).max(30).transform(normalizeArPhone),
  email: z.string().email().or(z.literal("")).optional().default(""),
  notes: z.string().trim().max(2000).optional().default(""),
  birth_date: z
    .string()
    .trim()
    .optional()
    .default("")
    .transform((v) => (v ? v : null)),
});

export const addWhitelistPatient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => whitelistSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Teléfono + nombre + apellido = un paciente. Si ya existe, se actualizan sus datos.
    const found = await findByIdentity(supabase, userId, data);
    const existing = { data: found, error: null as null | { message: string } };
    if (existing.error) throw new Error(existing.error.message);
    if (existing.data) {
      const upd = await supabase
        .from("patients")
        .update({ ...data, is_allowed: true })
        .eq("id", existing.data.id)
        .select()
        .single();
      if (upd.error) throw new Error(upd.error.message);
      return upd.data;
    }
    const ins = await supabase
      .from("patients")
      .insert({ ...data, owner_id: userId, is_allowed: true })
      .select()
      .single();
    if (ins.error) throw new Error(ins.error.message);
    return ins.data;
  });

export const updateWhitelistPatient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => whitelistSchema.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const clash = await findByIdentity(context.supabase, context.userId, rest, id);
    if (clash) {
      throw new Error(`Ya existe un paciente ${clash.first_name} ${clash.last_name} con ese teléfono.`);
    }
    const { error } = await context.supabase
      .from("patients")
      .update(rest)
      .eq("id", id)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setPatientAllowed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), allowed: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("patients")
      .update({ is_allowed: data.allowed })
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setPatientBlocked = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), blocked: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const patch = data.blocked
      ? { is_blocked: true }
      : { is_blocked: false, absence_reset_at: new Date().toISOString() };
    const { error } = await context.supabase
      .from("patients")
      .update(patch)
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePatient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("patients")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const checkBookingAllowed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ dni: z.string(), phone: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const cfg = await supabase
      .from("professional_config")
      .select("booking_access_mode")
      .eq("owner_id", userId)
      .maybeSingle();
    const mode = cfg.data?.booking_access_mode ?? "open";
    if (mode !== "whitelist") return { allowed: true, mode };
    const p = await supabase
      .from("patients")
      .select("id, is_allowed")
      .eq("owner_id", userId)
      .eq("dni", data.dni)
      .maybeSingle();
    return { allowed: !!p.data?.is_allowed, mode };
  });