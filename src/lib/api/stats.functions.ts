import { compareByName } from "@/lib/sort";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({ month: z.number().int().min(0).max(11), year: z.number().int().min(2000).max(2100) });

export const getMonthlySummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data, context }) => {
    const start = new Date(data.year, data.month, 1);
    const end = new Date(data.year, data.month + 1, 1);
    const prevStart = new Date(data.year, data.month - 1, 1);

    const [current, previous, patients] = await Promise.all([
      context.supabase
        .from("appointments")
        .select("id, start_at, status, attendance, patient_id, created_at, reschedule_count, patient:patients(first_name, last_name)")
        .eq("owner_id", context.userId)
        .gte("start_at", start.toISOString())
        .lt("start_at", end.toISOString())
        .order("start_at"),
      context.supabase
        .from("appointments")
        .select("id, status, attendance, patient_id")
        .eq("owner_id", context.userId)
        .gte("start_at", prevStart.toISOString())
        .lt("start_at", start.toISOString()),
      context.supabase
        .from("patients")
        .select("id, first_name, last_name, created_at")
        .eq("owner_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    if (current.error) throw new Error(current.error.message);
    if (previous.error) throw new Error(previous.error.message);
    if (patients.error) throw new Error(patients.error.message);

    // Ingresos: suma del precio del tipo de turno de los turnos no cancelados, últimos 6 meses.
    const incomeStart = new Date(data.year, data.month - 5, 1);
    const incomeRes = await context.supabase
      .from("appointments")
      .select("start_at, status, type:appointment_types(price_ars)")
      .eq("owner_id", context.userId)
      .neq("status", "cancelled")
      .gte("start_at", incomeStart.toISOString())
      .lt("start_at", end.toISOString());
    if (incomeRes.error) throw new Error(incomeRes.error.message);
    const incomeByMonth = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(data.year, data.month - 5 + i, 1);
      return { year: d.getFullYear(), month: d.getMonth(), total: 0 };
    });
    for (const r of incomeRes.data ?? []) {
      const d = new Date(r.start_at);
      const slot = incomeByMonth.find((m) => m.year === d.getFullYear() && m.month === d.getMonth());
      if (slot) slot.total += Number((r.type as any)?.price_ars ?? 0);
    }

    const histRes = await context.supabase
      .from("appointments")
      .select("start_at, status, attendance, patient_id, reschedule_count, patient:patients(first_name, last_name)")
      .eq("owner_id", context.userId)
      .lt("start_at", end.toISOString())
      .limit(10000);
    if (histRes.error) throw new Error(histRes.error.message);
    const hist = histRes.data ?? [];

    const cur = current.data ?? [];
    const prev = previous.data ?? [];

    const countActive = (rows: { status: string }[]) => rows.filter((r) => r.status !== "cancelled").length;
    const cancelled = (rows: { status: string }[]) => rows.filter((r) => r.status === "cancelled").length;
    const uniquePatients = (rows: { patient_id: string }[]) => new Set(rows.map((r) => r.patient_id)).size;
    const attendanceRate = (rows: { attendance: string }[]) => {
      const marked = rows.filter((r) => r.attendance && r.attendance !== "pending");
      if (!marked.length) return null;
      return Math.round((marked.filter((r) => r.attendance === "attended").length / marked.length) * 100);
    };

    const byWeekday = Array.from({ length: 7 }, () => 0);
    for (const r of hist) {
      if (r.status === "cancelled") continue;
      byWeekday[new Date(r.start_at).getDay()] += 1;
    }
    const maxWeekday = Math.max(1, ...byWeekday);

    const nameOf = (r: any) =>
      [r.patient?.first_name, r.patient?.last_name].filter(Boolean).join(" ").trim() || "Paciente";

    const tally = (rows: any[], amount: (r: any) => number) => {
      const map = new Map<string, { name: string; value: number }>();
      for (const r of rows) {
        const v = amount(r);
        if (v <= 0) continue;
        const key = r.patient_id as string;
        const entry = map.get(key) ?? { name: nameOf(r), value: 0 };
        entry.value += v;
        map.set(key, entry);
      }
      return [...map.values()].sort((a, b) => b.value - a.value || compareByName(a.name, b.name)).slice(0, 5);
    };

    const topAbsences = tally(hist, (r) =>
      r.attendance === "absent_notified" || r.attendance === "absent_no_notice" ? 1 : 0,
    );
    const topReschedules = tally(hist, (r) => Number(r.reschedule_count ?? 0));
    const topAttended = tally(hist, (r) => (r.attendance === "attended" ? 1 : 0));

    const recent = [
      ...cur
        .slice()
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
        .slice(0, 5)
        .map((r) => ({
          kind: r.status === "cancelled" ? ("cancelled" as const) : ("appointment" as const),
          label: r.status === "cancelled" ? "Turno cancelado" : "Turno confirmado",
          name: [(r.patient as any)?.first_name, (r.patient as any)?.last_name].filter(Boolean).join(" ") || "Paciente",
          at: r.created_at as string,
        })),
      ...(patients.data ?? []).slice(0, 5).map((p) => ({
        kind: "patient" as const,
        label: "Nuevo paciente",
        name: `${p.first_name} ${p.last_name}`.trim(),
        at: p.created_at as string,
      })),
    ]
      .sort((a, b) => (a.at < b.at ? 1 : -1))
      .slice(0, 6);

    return {
      appointments: countActive(cur),
      appointmentsPrev: countActive(prev),
      patients: uniquePatients(cur.filter((r) => r.status !== "cancelled")),
      patientsPrev: uniquePatients(prev.filter((r) => r.status !== "cancelled")),
      cancellations: cancelled(cur),
      cancellationsPrev: cancelled(prev),
      attendanceRate: attendanceRate(cur),
      attendanceRatePrev: attendanceRate(prev),
      byWeekday,
      maxWeekday,
      recent,
      topAbsences,
      topReschedules,
      topAttended,
      incomeByMonth,
      income: incomeByMonth[5].total,
      incomePrev: incomeByMonth[4].total,
    };
  });
