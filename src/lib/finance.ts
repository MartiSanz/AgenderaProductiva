/**
 * Cálculos financieros de Agendera (fuente única para tarjetas, tablas, gráficos y CSV).
 * Todos los importes en ARS. Fechas "YYYY-MM-DD" en hora local de Argentina.
 */

export type FinanceEntry = {
  id: string;
  concept: string;
  category: string;
  kind: "investment" | "operating";
  frequency: "once" | "monthly" | "yearly";
  currency: "ARS" | "USD";
  amount: number;
  fx_rate: number | null;
  amount_ars: number;
  entry_date: string;
  end_date: string | null;
  provider?: string;
  description?: string;
  /** Generado automáticamente (no editable). */
  auto?: boolean;
};

/**
 * Gasto mensual automático de WhatsApp: un registro mensual por mes con envíos,
 * vigente del 1 al último día del mes, para que cuente como costo fijo del mes en curso.
 */
export function whatsappMonthlyEntries(messagesByMonth: Record<string, number>, usdToArs: number, usdPerMessage: number, vat: number): FinanceEntry[] {
  return Object.entries(messagesByMonth)
    .filter(([, n]) => n > 0)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, n]) => {
      const [y, m] = month.split("-").map(Number);
      const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const usd = Math.round(n * usdPerMessage * (1 + vat) * 10000) / 10000;
      return {
        id: `auto-whatsapp-${month}`, concept: `WhatsApp ${month} (${n} mensajes)`, category: "Mensajería", kind: "operating" as const,
        frequency: "monthly" as const, currency: "USD" as const, amount: usd, fx_rate: usdToArs, amount_ars: r2(usd * usdToArs),
        entry_date: `${month}-01`, end_date: `${month}-${String(last).padStart(2, "0")}`, provider: "Meta WhatsApp",
        description: "Se actualiza solo con cada mensaje enviado (US$ por mensaje + IVA, dólar oficial venta).", auto: true,
      };
    });
}

export type Occurrence = { date: string; amount: number; kind: FinanceEntry["kind"]; category: string; entryId: string; concept: string };

export type IncomeSource = "basic" | "pro" | "packs" | "other";
export type Income = { date: string; amount: number; source: IncomeSource; professional: string; concept: string; period: string | null; method: string };

export type MonthRow = { month: string; income: number; expenses: number; investment: number; net: number; cumIncome: number; cumCost: number };

export const KIND_LABELS = { investment: "Inversión inicial", operating: "Gasto operativo" } as const;
export const FREQ_LABELS = { once: "Único", monthly: "Mensual", yearly: "Anual" } as const;
export const SOURCE_LABELS: Record<IncomeSource, string> = { basic: "Plan Base", pro: "Plan Pro", packs: "Packs de mensajes", other: "Otros" };

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Equivalente en ARS: los gastos en USD usan el tipo de cambio histórico cargado. */
export function toArs(amount: number, currency: "ARS" | "USD", fx: number | null) {
  if (currency === "ARS") return r2(amount);
  if (!fx || fx <= 0) throw new Error("Falta el tipo de cambio para el gasto en dólares.");
  return r2(amount * fx);
}

export function monthOf(date: string) {
  return date.slice(0, 7);
}

function addMonths(date: string, n: number) {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

/** Cargos de un registro hasta `until` inclusive. Los recurrentes se repiten cada mes/año sin duplicarse. */
export function expandEntry(e: FinanceEntry, until: string): Occurrence[] {
  const base = { amount: Number(e.amount_ars), kind: e.kind, category: e.category, entryId: e.id, concept: e.concept };
  if (e.frequency === "once") return e.entry_date <= until ? [{ ...base, date: e.entry_date }] : [];
  const step = e.frequency === "monthly" ? 1 : 12;
  const stop = e.end_date && e.end_date < until ? e.end_date : until;
  const out: Occurrence[] = [];
  for (let i = 0; i < 1200; i++) {
    const d = addMonths(e.entry_date, i * step);
    if (d > stop) break;
    out.push({ ...base, date: d });
  }
  return out;
}

export function occurrences(entries: FinanceEntry[], until: string) {
  return entries.flatMap((e) => expandEntry(e, until));
}

export type Summary = {
  investment: number;
  operating: number;
  income: number;
  result: number;
  toRecover: number;
  pending: number;
  surplus: number;
  recoveredPctInvestment: number | null;
  recoveredPctTotal: number | null;
  periodIncome: number;
  periodExpenses: number;
  periodNet: number;
};

/** Acumulados hasta `end` (nunca después de hoy: lo futuro es previsto, no real) y valores del período [start, end]. */
export function summarize(entries: FinanceEntry[], incomes: Income[], start: string, end: string, today: string): Summary {
  const cut = end < today ? end : today;
  const occ = occurrences(entries, cut);
  const investment = r2(occ.filter((o) => o.kind === "investment").reduce((s, o) => s + o.amount, 0));
  const operating = r2(occ.filter((o) => o.kind === "operating").reduce((s, o) => s + o.amount, 0));
  const income = r2(incomes.filter((i) => i.date <= cut).reduce((s, i) => s + i.amount, 0));
  const toRecover = r2(investment + operating);
  const periodIncome = r2(incomes.filter((i) => i.date >= start && i.date <= cut).reduce((s, i) => s + i.amount, 0));
  const periodExpenses = r2(occ.filter((o) => o.kind === "operating" && o.date >= start).reduce((s, o) => s + o.amount, 0));
  return {
    investment,
    operating,
    income,
    result: r2(income - toRecover),
    toRecover,
    pending: r2(Math.max(0, toRecover - income)),
    surplus: r2(Math.max(0, income - toRecover)),
    recoveredPctInvestment: investment > 0 ? Math.min(1, income / investment) : null,
    recoveredPctTotal: toRecover > 0 ? Math.min(1, income / toRecover) : null,
    periodIncome,
    periodExpenses,
    periodNet: r2(periodIncome - periodExpenses),
  };
}

export function monthsBetween(from: string, to: string) {
  const out: string[] = [];
  let m = from.slice(0, 7);
  const end = to.slice(0, 7);
  while (m <= end && out.length < 600) {
    out.push(m);
    m = addMonths(`${m}-01`, 1).slice(0, 7);
  }
  return out;
}

/** Serie mensual real (ingresos cobrados vs gastos reconocidos) con acumulados desde el inicio. */
export function monthlySeries(entries: FinanceEntry[], incomes: Income[], months: string[], today: string): MonthRow[] {
  if (months.length === 0) return [];
  const occ = occurrences(entries, today);
  const first = months[0];
  let cumIncome = incomes.filter((i) => monthOf(i.date) < first).reduce((s, i) => s + i.amount, 0);
  let cumCost = occ.filter((o) => monthOf(o.date) < first).reduce((s, o) => s + o.amount, 0);
  return months.map((month) => {
    const income = r2(incomes.filter((i) => monthOf(i.date) === month).reduce((s, i) => s + i.amount, 0));
    const mo = occ.filter((o) => monthOf(o.date) === month);
    const expenses = r2(mo.filter((o) => o.kind === "operating").reduce((s, o) => s + o.amount, 0));
    const investment = r2(mo.filter((o) => o.kind === "investment").reduce((s, o) => s + o.amount, 0));
    cumIncome += income;
    cumCost += expenses + investment;
    return { month, income, expenses, investment, net: r2(income - expenses), cumIncome: r2(cumIncome), cumCost: r2(cumCost) };
  });
}

/** Costo fijo mensual vigente en `date`: gastos operativos recurrentes activos (anuales prorrateados /12). */
export function monthlyFixedCost(entries: FinanceEntry[], date: string) {
  return r2(
    entries
      .filter((e) => e.kind === "operating" && e.frequency !== "once" && e.entry_date <= date && (!e.end_date || e.end_date >= date))
      .reduce((s, e) => s + Number(e.amount_ars) / (e.frequency === "yearly" ? 12 : 1), 0),
  );
}

export type BreakEvenInput = { fixedMonthly: number; basicCount: number; proCount: number; priceBasic: number; pricePro: number; variablePerPro: number; mixProShare?: number };

/**
 * Punto de equilibrio mensual por margen de contribución ponderado.
 * Mezcla Base/Pro: la configurada (mixProShare 0..1) o la distribución actual.
 */
export function breakEven(i: BreakEvenInput) {
  const total = i.basicCount + i.proCount;
  const proShare = i.mixProShare ?? (total > 0 ? i.proCount / total : 0.5);
  const marginBasic = i.priceBasic - i.variablePerPro;
  const marginPro = i.pricePro - i.variablePerPro;
  const margin = r2(marginBasic * (1 - proShare) + marginPro * proShare);
  if (margin <= 0) return { margin, proShare, needed: null as number | null, current: total, missing: null as number | null };
  const needed = Math.ceil(i.fixedMonthly / margin - 1e-9);
  return { margin, proShare, needed, current: total, missing: Math.max(0, needed - total) };
}

/** Meses hasta recuperar `pending` con un flujo neto mensual proyectado. null si el flujo es ≤ 0. */
export function monthsToRecover(pending: number, monthlyNet: number) {
  if (pending <= 0) return 0;
  if (monthlyNet <= 0) return null;
  return Math.ceil(pending / monthlyNet - 1e-9);
}

export type Scenario = {
  active: number;
  newPerMonth: number;
  churnPct: number; // 0..100 mensual
  proSharePct: number; // 0..100
  priceBasic: number;
  pricePro: number;
  messagesPerPro: number;
  costPerMessage: number;
  packsPerMonth: number; // ARS por mes en packs
  fixedMonthly: number;
  variablePerPro: number; // otros costos variables por profesional
};

export type ProjectionRow = { month: number; active: number; income: number; expenses: number; net: number; cumNet: number };

/** Proyección mes a mes. Nunca se mezcla con datos reales. */
export function project(s: Scenario, months: number, startPending: number): { rows: ProjectionRow[]; recoveryMonth: number | null } {
  const rows: ProjectionRow[] = [];
  let active = s.active;
  let cumNet = 0;
  let recoveryMonth: number | null = startPending <= 0 ? 0 : null;
  for (let m = 1; m <= months; m++) {
    active = Math.max(0, active * (1 - s.churnPct / 100) + s.newPerMonth);
    const pro = active * (s.proSharePct / 100);
    const income = r2((active - pro) * s.priceBasic + pro * s.pricePro + s.packsPerMonth);
    const expenses = r2(s.fixedMonthly + active * (s.messagesPerPro * s.costPerMessage + s.variablePerPro));
    const net = r2(income - expenses);
    cumNet = r2(cumNet + net);
    if (recoveryMonth === null && cumNet >= startPending) recoveryMonth = m;
    rows.push({ month: m, active: Math.round(active * 10) / 10, income, expenses, net, cumNet });
  }
  return { rows, recoveryMonth };
}

/** Morosidad: profesionales con algo vencido / con obligación de pago. */
export function rate(part: number, whole: number) {
  return whole > 0 ? part / whole : null;
}

export function toCsv(rows: (string | number | null)[][]) {
  return rows
    .map((r) => r.map((c) => {
      const v = c == null ? "" : String(c);
      return /[",;\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    }).join(","))
    .join("\n");
}
