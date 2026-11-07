import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { cutoffISO } from "@/lib/retention.utils";

type Row = Record<string, string | number | boolean | null>;

export const getRetentionStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: cfg } = await supabase
      .from("professional_config")
      .select("retention_years, purge_reminder_snoozed_until")
      .eq("owner_id", userId)
      .maybeSingle();

    const years = cfg?.retention_years ?? 10;
    const snoozedUntil = cfg?.purge_reminder_snoozed_until ?? null;
    const cutoff = cutoffISO(years);

    const { data, error } = await supabase
      .from("appointments")
      .select("id, patient_id, start_at")
      .eq("owner_id", userId)
      .lt("end_at", cutoff)
      .order("start_at", { ascending: true });
    if (error) throw new Error(error.message);

    const rows = data ?? [];
    // el último turno de cada paciente nunca se borra
    const lastByPatient = new Map<string, string>();
    for (const r of rows) lastByPatient.set(r.patient_id, r.id);
    const purgeable = rows.filter((r) => lastByPatient.get(r.patient_id) !== r.id);

    const snoozed = snoozedUntil ? new Date(snoozedUntil) >= new Date() : false;

    return {
      years,
      cutoff,
      snoozedUntil,
      snoozed,
      purgeableCount: purgeable.length,
      rangeFrom: purgeable[0]?.start_at ?? null,
      rangeTo: purgeable[purgeable.length - 1]?.start_at ?? null,
    };
  });

export const updateRetentionYears = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ years: z.number().int().refine((v) => [1, 2, 5, 10].includes(v)) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("professional_config")
      .update({ retention_years: data.years })
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const snoozeRetentionNotice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const until = new Date();
    until.setDate(until.getDate() + 30);
    const { error } = await context.supabase
      .from("professional_config")
      .update({ purge_reminder_snoozed_until: until.toISOString().slice(0, 10) })
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const exportPatientsData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Row[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("patients")
      .select("id, last_name, first_name, dni, phone, email, birth_date, is_allowed, notes, created_at")
      .eq("owner_id", userId)
      .order("last_name", { ascending: true });
    if (error) throw new Error(error.message);

    const { data: appointments, error: apptErr } = await supabase
      .from("appointments")
      .select("patient_id, start_at")
      .eq("owner_id", userId)
      .order("start_at", { ascending: false });
    if (apptErr) throw new Error(apptErr.message);

    const lastByPatient = new Map<string, string>();
    for (const a of appointments ?? []) {
      if (!lastByPatient.has(a.patient_id)) {
        lastByPatient.set(a.patient_id, a.start_at);
      }
    }

    return (data ?? []).map((r) => ({
      Apellido: r.last_name ?? "",
      Nombre: r.first_name ?? "",
      DNI: r.dni ?? "",
      Teléfono: r.phone ?? "",
      Email: r.email ?? "",
      "Fecha de nacimiento": r.birth_date ? new Date(r.birth_date).toLocaleDateString("es-AR") : "",
      Autorizado: r.is_allowed ? "Sí" : "No",
      Notas: r.notes ?? "",
      "Fecha de alta": r.created_at ? new Date(r.created_at).toLocaleDateString("es-AR") : "",
      "Última consulta": lastByPatient.get(r.id) ? new Date(lastByPatient.get(r.id)!).toLocaleDateString("es-AR") : "",
    })) as Row[];
  });

const statusLabel: Record<string, string> = {
  active: "Activo",
  cancelled: "Cancelado",
  completed: "Completado",
};

const attendanceLabel: Record<string, string> = {
  pending: "Pendiente",
  attended: "Asistió",
  absent_notified: "Ausente con aviso",
  absent_no_notice: "Ausente sin aviso",
};

export const exportAppointmentsData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ from: z.string().optional(), to: z.string().optional(), beforeCutoff: z.boolean().optional() })
      .default({})
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<Row[]> => {
    const { supabase, userId } = context;
    let q = supabase
      .from("appointments")
      .select("start_at, end_at, status, attendance, notes, patients(first_name, last_name, dni, phone)")
      .eq("owner_id", userId)
      .order("start_at", { ascending: true });

    if (data.beforeCutoff) {
      const { data: cfg } = await supabase
        .from("professional_config")
        .select("retention_years")
        .eq("owner_id", userId)
        .maybeSingle();
      q = q.lt("end_at", cutoffISO(cfg?.retention_years ?? 10));
    }
    if (data.from) q = q.gte("start_at", new Date(data.from).toISOString());
    if (data.to) q = q.lte("start_at", new Date(`${data.to}T23:59:59`).toISOString());

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    return (rows ?? []).map((r) => {
      const p = (r as { patients?: { first_name?: string; last_name?: string; dni?: string; phone?: string } }).patients;
      const start = new Date(r.start_at);
      const end = new Date(r.end_at);
      return {
        Fecha: start.toLocaleDateString("es-AR"),
        "Hora inicio": start.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
        "Hora fin": end.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
        "Duración min": Math.round((end.getTime() - start.getTime()) / 60000),
        Paciente: `${p?.last_name ?? ""} ${p?.first_name ?? ""}`.trim(),
        DNI: p?.dni ?? "",
        Teléfono: p?.phone ?? "",
        Estado: statusLabel[r.status] ?? r.status,
        Asistencia: attendanceLabel[r.attendance] ?? r.attendance,
        Notas: r.notes ?? "",
      } as Row;
    });
  });

export const purgeOldHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: cfg } = await supabase
      .from("professional_config")
      .select("retention_years")
      .eq("owner_id", userId)
      .maybeSingle();
    const years = cfg?.retention_years ?? 10;
    const cutoff = cutoffISO(years);

    const { data, error } = await supabase
      .from("appointments")
      .select("id, patient_id, start_at, attendance, status")
      .eq("owner_id", userId)
      .lt("end_at", cutoff)
      .order("start_at", { ascending: true });
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    if (rows.length === 0) return { deleted: 0 };

    const lastByPatient = new Map<string, string>();
    for (const r of rows) lastByPatient.set(r.patient_id, r.id);
    const purgeable = rows.filter((r) => lastByPatient.get(r.patient_id) !== r.id);
    if (purgeable.length === 0) return { deleted: 0 };

    // archivar resumen por paciente antes de borrar
    const byPatient = new Map<string, typeof purgeable>();
    for (const r of purgeable) {
      const list = byPatient.get(r.patient_id) ?? [];
      list.push(r);
      byPatient.set(r.patient_id, list);
    }

    for (const [patientId, list] of byPatient) {
      const { data: patient } = await supabase
        .from("patients")
        .select("history_summary")
        .eq("id", patientId)
        .eq("owner_id", userId)
        .maybeSingle();
      const prev = (patient?.history_summary ?? {}) as {
        total?: number;
        first_visit?: string;
        last_visit?: string;
        attended?: number;
        absences?: number;
      };
      const attended = list.filter((r) => r.attendance === "attended").length;
      const absences = list.filter((r) => r.attendance === "absent_notified" || r.attendance === "absent_no_notice").length;
      const firstVisit = list[0]!.start_at;
      const lastVisit = list[list.length - 1]!.start_at;
      const summary = {
        total: (prev.total ?? 0) + list.length,
        first_visit: prev.first_visit && prev.first_visit < firstVisit ? prev.first_visit : firstVisit,
        last_visit: prev.last_visit && prev.last_visit > lastVisit ? prev.last_visit : lastVisit,
        attended: (prev.attended ?? 0) + attended,
        absences: (prev.absences ?? 0) + absences,
        archived_at: new Date().toISOString(),
      };
      await supabase.from("patients").update({ history_summary: summary }).eq("id", patientId).eq("owner_id", userId);
    }

    const ids = purgeable.map((r) => r.id);
    const { error: delErr } = await supabase.from("appointments").delete().in("id", ids).eq("owner_id", userId);
    if (delErr) throw new Error(delErr.message);

    await supabase.from("purge_log").insert({
      owner_id: userId,
      deleted_count: ids.length,
      range_from: purgeable[0]!.start_at.slice(0, 10),
      range_to: purgeable[purgeable.length - 1]!.start_at.slice(0, 10),
    });

    return { deleted: ids.length };
  });