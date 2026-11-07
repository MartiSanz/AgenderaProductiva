/** Reglas de cobro: corte el día 10; aviso automático solo el día 9 (impagos). */
export const CUTOFF_DAY = 10;
export const DUE_SOON_FROM_DAY = 7;

export type BillingStatus = "paid" | "pending" | "due_soon" | "overdue";

export function billingStatus(paid: boolean, dayOfMonth: number): BillingStatus {
  if (paid) return "paid";
  if (dayOfMonth > CUTOFF_DAY) return "overdue";
  if (dayOfMonth >= DUE_SOON_FROM_DAY) return "due_soon";
  return "pending";
}

/** Qué recordatorio corresponde hoy, o null. Único aviso automático: día 9, solo para quienes no pagaron. */
export function reminderKindFor(dayOfMonth: number, paid: boolean): "start" | "due" | null {
  if (dayOfMonth === 9 && !paid) return "due";
  return null;
}

/** A mes vencido: el período "YYYY-MM" vence el día 10 del mes siguiente → "10/MM/YYYY". */
export function deadlineLabel(period: string) {
  const [y, m] = nextPeriod(period).split("-");
  return `${CUTOFF_DAY}/${m}/${y}`;
}

/** "YYYY-MM" del mes siguiente. */
export function nextPeriod(period: string) {
  const [y, m] = period.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

/** Día del mes de cobro (period+1) que corresponde a hoy: 0 si aún no llegó, 31 si ya pasó. */
export function billingDayFor(period: string, today: { period: string; day: number }) {
  const due = nextPeriod(period);
  return due < today.period ? 31 : due > today.period ? 0 : today.day;
}

/** 10000 → "10.000" */
export function formatAmount(n: number) {
  return Math.round(n).toLocaleString("es-AR").replace(/,/g, ".");
}

/** Fecha local Argentina: { period: "YYYY-MM", day } */
export function todayAR(d = new Date()) {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return { period: `${g("year")}-${g("month")}`, day: Number(g("day")), date: `${g("year")}-${g("month")}-${g("day")}` };
}

/** "YYYY-MM" del mes anterior. */
export function previousPeriod(period: string) {
  const [y, m] = period.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

export type PlanDue = { period: string; status: "pending" | "due_soon" | "overdue" };

/** A mes vencido: períodos impagos desde el alta hasta el mes anterior; el mes en curso nunca se cobra todavía. */
export function unpaidPlanPeriods(paidPeriods: string[], today: { period: string; day: number }, sincePeriod: string): PlanDue[] {
  const paid = new Set(paidPeriods);
  const out: PlanDue[] = [];
  for (let p = sincePeriod; p < today.period; p = nextPeriod(p)) {
    if (paid.has(p)) continue;
    const s = billingStatus(false, billingDayFor(p, today));
    out.push({ period: p, status: s === "paid" ? "pending" : s });
  }
  return out;
}

/** A mes vencido: un pack impago se cobra recién cuando termina el mes en que se compró. */
export function isPackBillable(pack: { payment_status: string; cancelled_at: string | null; purchased_at: string }, today: { period: string }) {
  return pack.payment_status === "pending" && !pack.cancelled_at && todayAR(new Date(pack.purchased_at)).period < today.period;
}

/** Aviso de deuda en el panel del profesional: desde el día 5; vencido desde el 11. */
export const DEBT_BANNER_FROM_DAY = 5;
export function debtBannerKind(dayOfMonth: number, hasDebt: boolean, hasPastDue = false): "due" | "overdue" | null {
  if (hasPastDue) return "overdue";
  if (!hasDebt || dayOfMonth < DEBT_BANNER_FROM_DAY) return null;
  return dayOfMonth > CUTOFF_DAY ? "overdue" : "due";
}
