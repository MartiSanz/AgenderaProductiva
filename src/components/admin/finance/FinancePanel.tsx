import { matchesSearch } from "@/lib/search";
import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Info, Download, Plus, Pencil, Trash2, Loader2, TrendingUp, TrendingDown, Wallet, PiggyBank, Target } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { changeFinancePrice, deleteFinanceEntry, getFinance } from "@/lib/api/finance.functions";
import {
  FREQ_LABELS, KIND_LABELS, SOURCE_LABELS, breakEven, monthOf, monthlyFixedCost, monthlySeries, monthsBetween, monthsToRecover,
  occurrences, project, rate, summarize, toCsv, type FinanceEntry, type IncomeSource, type Scenario,
} from "@/lib/finance";
import { WA_USD_PER_MESSAGE, AR_VAT } from "@/lib/whatsappCost";
import { EntryDialog } from "./EntryDialog";

const ars = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`;
const pct = (n: number | null) => (n == null ? "—" : `${(n * 100).toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`);
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const monthLabel = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`;
const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--muted-foreground)"];

function download(name: string, rows: (string | number | null)[][]) {
  const blob = new Blob(["\ufeff" + toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function Hint({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" aria-label="Qué significa" className="text-muted-foreground hover:text-foreground"><Info className="h-3.5 w-3.5" /></button>
      </TooltipTrigger>
      <TooltipContent className="max-w-64 text-xs">{text}</TooltipContent>
    </Tooltip>
  );
}

function Kpi({ label, value, hint, sub, tone, big, icon }: { label: string; value: string; hint: string; sub?: ReactNode; tone?: "good" | "bad"; big?: boolean; icon?: ReactNode }) {
  return (
    <Card className="rounded-2xl">
      <CardContent className={big ? "p-5" : "p-4"}>
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">{icon}{label}<Hint text={hint} /></div>
        <div className={`mt-1 font-bold tracking-tight ${big ? "text-3xl" : "text-xl"} ${tone === "good" ? "text-chart-2" : tone === "bad" ? "text-destructive" : ""}`}>{value}</div>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{children}</p>;
}

type Range = { mode: "month" | "year" | "range"; month: string; year: string; from: string; to: string };

function rangeDates(r: Range) {
  if (r.mode === "month") {
    const [y, m] = r.month.split("-").map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { start: `${r.month}-01`, end: `${r.month}-${String(last).padStart(2, "0")}` };
  }
  if (r.mode === "year") return { start: `${r.year}-01-01`, end: `${r.year}-12-31` };
  return { start: r.from, end: r.to < r.from ? r.from : r.to };
}

export type FinanceTab = "resumen" | "ingresos" | "gastos" | "rentabilidad" | "proyecciones";

const TAB_TITLES: Record<FinanceTab, string> = {
  resumen: "Resumen",
  ingresos: "Ingresos",
  gastos: "Gastos e inversiones",
  rentabilidad: "Rentabilidad",
  proyecciones: "Proyecciones",
};

export function FinancePanel({ tab }: { tab: FinanceTab }) {
  const fetchFinance = useServerFn(getFinance);
  const q = useQuery({ queryKey: ["admin-finance"], queryFn: () => fetchFinance() });
  const [range, setRange] = useState<Range | null>(null);

  if (q.isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (q.error || !q.data)
    return (
      <Card className="rounded-2xl"><CardContent className="space-y-3 p-6 text-center">
        <p className="text-sm text-muted-foreground">No pudimos cargar las finanzas.</p>
        <Button variant="outline" onClick={() => q.refetch()}>Reintentar</Button>
      </CardContent></Card>
    );
  const today = q.data.today;
  const r = range ?? { mode: "month" as const, month: today.slice(0, 7), year: today.slice(0, 4), from: `${today.slice(0, 7)}-01`, to: today };
  return (
    <TooltipProvider delayDuration={150}>
      <FinanceBody data={q.data} range={r} setRange={setRange} tab={tab} />
    </TooltipProvider>
  );
}

type Data = Awaited<ReturnType<typeof getFinance>>;

function FinanceBody({ data, range, setRange, tab }: { data: Data; range: Range; setRange: (r: Range) => void; tab: FinanceTab }) {
  const { today, entries, incomes } = data;
  const { start, end } = rangeDates(range);
  const s = useMemo(() => summarize(entries, incomes, start, end, today), [entries, incomes, start, end, today]);

  const firstMonth = useMemo(() => {
    const ds = [...entries.map((e) => e.entry_date), ...incomes.map((i) => i.date)].sort();
    return (ds[0] ?? today).slice(0, 7);
  }, [entries, incomes, today]);
  const series = useMemo(() => {
    const endM = (end < today ? end : today).slice(0, 7);
    const all = monthsBetween(firstMonth, endM);
    return monthlySeries(entries, incomes, all.slice(-12), today);
  }, [entries, incomes, firstMonth, end, today]);

  const noSeries = series.every((m) => !m.income && !m.expenses && !m.investment);
  const fixedNow = monthlyFixedCost(entries, today);
  const last3 = monthlySeries(entries, incomes, monthsBetween(firstMonth, today).slice(-4, -1), today);
  const avgIncome = last3.length ? last3.reduce((a, m) => a + m.income, 0) / last3.length : 0;
  const recoverIn = monthsToRecover(s.pending, avgIncome - fixedNow);

  const receivable = data.receivables.reduce((a, x) => a + x.amount, 0);
  const debtors = new Set(data.receivables.filter((x) => x.status === "overdue").map((x) => x.user_id));
  const owers = new Set(data.receivables.map((x) => x.user_id));
  const years = Array.from(new Set([today.slice(0, 4), firstMonth.slice(0, 4)])).sort();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-2">
        <Select value={range.mode} onValueChange={(v) => setRange({ ...range, mode: v as Range["mode"] })}>
          <SelectTrigger className="w-36 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="month">Mes</SelectItem><SelectItem value="year">Año</SelectItem><SelectItem value="range">Rango</SelectItem></SelectContent>
        </Select>
        {range.mode === "month" && <Input type="month" className="w-44 rounded-xl" value={range.month} max={today.slice(0, 7)} onChange={(e) => e.target.value && setRange({ ...range, month: e.target.value })} />}
        {range.mode === "year" && (
          <Select value={range.year} onValueChange={(v) => setRange({ ...range, year: v })}>
            <SelectTrigger className="w-28 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>{Array.from({ length: Number(years[years.length - 1]) - Number(years[0]) + 1 }, (_, i) => String(Number(years[0]) + i)).map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
          </Select>
        )}
        {range.mode === "range" && (
          <>
            <Input type="date" aria-label="Desde" className="w-40 rounded-xl" value={range.from} onChange={(e) => e.target.value && setRange({ ...range, from: e.target.value })} />
            <Input type="date" aria-label="Hasta" className="w-40 rounded-xl" value={range.to} onChange={(e) => e.target.value && setRange({ ...range, to: e.target.value })} />
          </>
        )}
        <span className="pb-2 text-xs text-muted-foreground">Acumulados calculados hasta {(end < today ? end : today).split("-").reverse().join("/")}</span>
      </div>

      <h2 className="text-xl font-bold tracking-tight">{TAB_TITLES[tab]}</h2>

      <Tabs value={tab}>

        <TabsContent value="resumen" className="space-y-5 pt-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi big icon={<PiggyBank className="h-3.5 w-3.5" />} label="¿Cuánto invertí?" value={ars(s.investment)} hint="Capital puesto para desarrollar y lanzar Agendera (registros de tipo inversión inicial)." sub={`+ ${ars(s.operating)} de gastos operativos`} />
            <Kpi big icon={<Wallet className="h-3.5 w-3.5" />} label="¿Cuánto ingresó?" value={ars(s.income)} hint="Dinero efectivamente cobrado desde el comienzo: abonos pagados y packs pagados. Lo pendiente no suma." />
            <Kpi big icon={s.result >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />} label="¿Cuánto gané o perdí?" value={ars(s.result)} tone={s.result >= 0 ? "good" : "bad"} hint="Resultado acumulado: ingresos cobrados − inversión inicial − gastos operativos." />
            <Kpi big icon={<Target className="h-3.5 w-3.5" />} label={s.pending > 0 ? "¿Cuánto me falta recuperar?" : "Excedente generado"} value={ars(s.pending > 0 ? s.pending : s.surplus)} tone={s.pending > 0 ? undefined : "good"} hint="Inversión + gastos operativos acumulados que todavía no se cubrieron con ingresos. Si ya se cubrieron, muestra la ganancia por encima." />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Kpi label="Costos operativos acumulados" value={ars(s.operating)} hint="Gastos para operar la plataforma desde el inicio, reconocidos hasta la fecha. Los previstos a futuro no suman." />
            <Kpi label="Ingresos del período" value={ars(s.periodIncome)} hint="Cobrado dentro del período elegido." />
            <Kpi label="Gastos del período" value={ars(s.periodExpenses)} hint="Gastos operativos reconocidos dentro del período (sin inversión inicial)." />
            <Kpi label="Resultado neto del período" value={ars(s.periodNet)} tone={s.periodNet >= 0 ? "good" : "bad"} hint="Ingresos del período − gastos operativos del período." />
            <Kpi label="Pagos pendientes" value={ars(receivable)} hint="Cuentas por cobrar: abonos y packs impagos. Nunca se cuentan como ingresos." sub={`${owers.size} profesional${owers.size === 1 ? "" : "es"} · ${debtors.size} con vencidos`} />
          </div>

          <Card className="rounded-2xl">
            <CardHeader><CardTitle>¿Cuánto falta para recuperar mi inversión?</CardTitle>
              <CardDescription>Dos lecturas por separado: solo la inversión inicial, y la recuperación completa sumando los gastos operativos.</CardDescription></CardHeader>
            <CardContent className="space-y-5">
              {s.toRecover === 0 ? (
                <Empty>Todavía no cargaste inversiones ni gastos. Agregalos en «Gastos e inversiones» para ver tu recuperación.</Empty>
              ) : (
                <>
                  <RecoveryBar label="Recuperación de la inversión inicial" pctValue={s.recoveredPctInvestment} detail={s.investment > 0 ? `${ars(Math.min(s.income, s.investment))} de ${ars(s.investment)}` : "Sin inversión inicial cargada"} />
                  <RecoveryBar label="Recuperación completa (inversión + gastos operativos)" pctValue={s.recoveredPctTotal} detail={`${ars(Math.min(s.income, s.toRecover))} de ${ars(s.toRecover)}`} />
                  <div className="grid gap-3 text-sm sm:grid-cols-3">
                    <Fact k="Monto total a recuperar" v={ars(s.toRecover)} />
                    <Fact k={s.pending > 0 ? "Saldo pendiente" : "Ganancia acumulada"} v={ars(s.pending > 0 ? s.pending : s.surplus)} />
                    <Fact k="Fecha estimada de recuperación" v={
                      s.pending <= 0 ? "Ya recuperada"
                        : last3.length === 0 ? "Faltan datos de ingresos"
                        : recoverIn == null ? "No estimable con el flujo actual"
                        : estimateDate(today, recoverIn)
                    } />
                  </div>
                  {s.pending > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Estimación: promedio cobrado de los últimos meses completos ({ars(avgIncome)}) menos el costo fijo mensual previsto ({ars(fixedNow)}).
                      {recoverIn == null && last3.length > 0 && " El flujo neto proyectado es cero o negativo, por eso no hay fecha estimable."}
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Ingresos vs. gastos" empty={noSeries}>
              <BarChart data={series.map((m) => ({ ...m, label: monthLabel(m.month) }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" fontSize={11} /><YAxis fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <RTooltip formatter={(v: number) => ars(v)} /><Legend />
                <Bar dataKey="income" name="Ingresos" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="expenses" name="Gastos operativos" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ChartCard>
            <ChartCard title="Recuperación acumulada" empty={noSeries}>
              <LineChart data={series.map((m) => ({ ...m, label: monthLabel(m.month) }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" fontSize={11} /><YAxis fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <RTooltip formatter={(v: number) => ars(v)} /><Legend />
                <Line dataKey="cumIncome" name="Cobrado acumulado" stroke="var(--chart-2)" strokeWidth={2} dot={false} />
                <Line dataKey="cumCost" name="Inversión + gastos acumulados" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartCard>
            <ChartCard title="Evolución del resultado neto mensual" empty={noSeries}>
              <BarChart data={series.map((m) => ({ ...m, label: monthLabel(m.month) }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" fontSize={11} /><YAxis fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <RTooltip formatter={(v: number) => ars(v)} />
                <Bar dataKey="net" name="Resultado neto" radius={[6, 6, 0, 0]}>
                  {series.map((m) => <Cell key={m.month} fill={m.net >= 0 ? "var(--chart-2)" : "var(--destructive)"} />)}
                </Bar>
              </BarChart>
            </ChartCard>
          </div>
          <div className="flex justify-end">
            <Button variant="outline" className="rounded-xl" onClick={() => download(`agendera-resumen-${today}.csv`, [
              ["Mes", "Ingresos", "Gastos operativos", "Inversión", "Resultado neto", "Cobrado acumulado", "Costos acumulados"],
              ...series.map((m) => [m.month, m.income, m.expenses, m.investment, m.net, m.cumIncome, m.cumCost]),
            ])}><Download className="mr-2 h-4 w-4" />Exportar CSV</Button>
          </div>
        </TabsContent>

        <TabsContent value="ingresos" className="pt-3"><IncomeTab data={data} start={start} end={end} /></TabsContent>
        <TabsContent value="gastos" className="pt-3"><ExpensesTab data={data} start={start} end={end} /></TabsContent>
        <TabsContent value="rentabilidad" className="pt-3"><ProfitTab data={data} start={start} end={end} fixedNow={fixedNow} /></TabsContent>
        <TabsContent value="proyecciones" className="pt-3"><ProjectionsTab data={data} fixedNow={fixedNow} pending={s.pending} /></TabsContent>
      </Tabs>
    </div>
  );
}

function estimateDate(today: string, months: number) {
  const [y, m] = today.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + months, 1));
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} (≈${months} mes${months === 1 ? "" : "es"})`;
}

function RecoveryBar({ label, pctValue, detail }: { label: string; pctValue: number | null; detail: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm"><span className="font-medium">{label}</span><span className="font-bold text-primary">{pct(pctValue)}</span></div>
      <Progress value={(pctValue ?? 0) * 100} className="h-3" />
      <p className="text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return <div className="rounded-xl bg-muted/50 p-3"><div className="text-xs text-muted-foreground">{k}</div><div className="font-semibold">{v}</div></div>;
}

function ChartCard({ title, empty, children }: { title: string; empty: boolean; children: ReactNode }) {
  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>{empty ? <Empty>Todavía no hay datos para este gráfico.</Empty> : <div className="h-64"><ResponsiveContainer width="100%" height="100%">{children as any}</ResponsiveContainer></div>}</CardContent>
    </Card>
  );
}

function IncomeTab({ data, start, end }: { data: Data; start: string; end: string }) {
  const [q, setQ] = useState("");
  const receivables = data.receivables.filter((r) => matchesSearch(q, r.name));
  const rows = data.incomes.filter((i) => i.date >= start && i.date <= end && matchesSearch(q, i.professional)).sort((a, b) => b.date.localeCompare(a.date));
  const bySource = (["basic", "pro", "packs", "other"] as IncomeSource[]).map((k) => ({ name: SOURCE_LABELS[k], value: rows.filter((r) => r.source === k).reduce((a, r) => a + r.amount, 0) })).filter((x) => x.value > 0);
  return (
    <div className="space-y-4">
      <Input placeholder="Buscar profesional por nombre…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm rounded-xl" />
      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <ChartCard title="Distribución de ingresos" empty={bySource.length === 0}>
          <PieChart><Pie data={bySource} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85}>{bySource.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}</Pie><RTooltip formatter={(v: number) => ars(v)} /><Legend /></PieChart>
        </ChartCard>
        <Card className="rounded-2xl">
          <CardHeader className="flex-row items-center justify-between pb-2">
            <div><CardTitle className="text-base">Cobros del período</CardTitle><CardDescription>Solo pagos confirmados, con el importe realmente cobrado.</CardDescription></div>
            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => download(`agendera-ingresos-${start}-${end}.csv`, [["Fecha", "Profesional", "Concepto", "Plan", "Monto", "Medio", "Estado", "Período"], ...rows.map((r) => [r.date, r.professional, r.concept, SOURCE_LABELS[r.source], r.amount, r.method, "Cobrado", r.period])])}><Download className="mr-1 h-4 w-4" />CSV</Button>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? <Empty>No hay cobros registrados en este período. Los pagos se registran en Cobranzas.</Empty> : (
              <div className="max-h-80 overflow-auto"><table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-1">Fecha</th><th>Profesional</th><th>Concepto</th><th>Tipo</th><th>Medio</th><th className="text-right">Monto</th></tr></thead>
                <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-border"><td className="py-1.5">{r.date.split("-").reverse().join("/")}</td><td>{r.professional}</td><td>{r.concept}</td><td>{SOURCE_LABELS[r.source]}</td><td className="text-muted-foreground">{r.method}</td><td className="text-right font-medium">{ars(r.amount)}</td></tr>)}</tbody>
              </table></div>
            )}
          </CardContent>
        </Card>
      </div>
      <Card className="rounded-2xl">
        <CardHeader className="pb-2"><CardTitle className="text-base">Cuentas por cobrar</CardTitle><CardDescription>Abonos y packs impagos a hoy. No se cuentan como dinero ingresado.</CardDescription></CardHeader>
        <CardContent>
          {receivables.length === 0 ? <Empty>No hay pagos pendientes.</Empty> : (
            <table className="w-full text-sm"><tbody>{receivables.map((r, i) => (
              <tr key={i} className="border-t border-border first:border-0"><td className="py-1.5">{r.name}</td><td>{r.concept}</td><td><Badge variant={r.status === "overdue" ? "destructive" : "secondary"}>{r.status === "overdue" ? "Vencido" : "Pendiente"}</Badge></td><td className="text-right font-medium">{ars(r.amount)}</td></tr>
            ))}</tbody></table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ExpensesTab({ data, start, end }: { data: Data; start: string; end: string }) {
  const qc = useQueryClient();
  const del = useServerFn(deleteFinanceEntry);
  const price = useServerFn(changeFinancePrice);
  const [editing, setEditing] = useState<FinanceEntry | "new" | null>(null);
  const [toDelete, setToDelete] = useState<FinanceEntry | null>(null);
  const [priceFor, setPriceFor] = useState<FinanceEntry | null>(null);
  const [priceForm, setPriceForm] = useState({ from: data.today, amount: "", fx: "" });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-finance"] });
  const delM = useMutation({ mutationFn: (id: string) => del({ data: { id } }), onSuccess: () => { toast.success("Registro eliminado"); setToDelete(null); refresh(); }, onError: (e: Error) => toast.error(e.message) });
  const priceM = useMutation({
    mutationFn: () => price({ data: { id: priceFor!.id, from: priceForm.from, amount: Number(priceForm.amount), fx_rate: priceFor!.currency === "USD" ? Number(priceForm.fx) || null : null } }),
    onSuccess: () => { toast.success("Nuevo precio registrado"); setPriceFor(null); refresh(); }, onError: (e: Error) => toast.error(e.message),
  });

  const cut = end < data.today ? end : data.today;
  const occ = occurrences(data.entries, cut).filter((o) => o.date >= start);
  const byCat = Object.entries(occ.reduce<Record<string, number>>((a, o) => ({ ...a, [o.category]: (a[o.category] ?? 0) + o.amount }), {})).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const future = data.entries.filter((e) => e.entry_date > data.today);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" className="rounded-xl" onClick={() => download(`agendera-gastos-${start}-${end}.csv`, [["Fecha", "Concepto", "Categoría", "Tipo", "Monto ARS"], ...occ.map((o) => [o.date, o.concept, o.category, KIND_LABELS[o.kind], o.amount])])}><Download className="mr-2 h-4 w-4" />Exportar CSV</Button>
        <Button className="rounded-xl" onClick={() => setEditing("new")}><Plus className="mr-2 h-4 w-4" />Agregar gasto o inversión</Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <ChartCard title="Distribución de costos del período" empty={byCat.length === 0}>
          <PieChart><Pie data={byCat} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85}>{byCat.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><RTooltip formatter={(v: number) => ars(v)} /><Legend /></PieChart>
        </ChartCard>
        <Card className="rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="text-base">Registros</CardTitle><CardDescription>Los recurrentes se reconocen solos cada mes o año; los de fecha futura quedan como previstos.</CardDescription></CardHeader>
          <CardContent>
            {data.entries.length === 0 ? <Empty>Cargá tu primera inversión o gasto para empezar a ver tu recuperación.</Empty> : (
              <div className="max-h-[28rem] space-y-2 overflow-auto">{data.entries.map((e) => (
                <div key={e.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border p-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{e.concept}</div>
                    <div className="text-xs text-muted-foreground">
                      {e.category} · {KIND_LABELS[e.kind]} · {FREQ_LABELS[e.frequency]} · desde {e.entry_date.split("-").reverse().join("/")}{e.end_date ? ` hasta ${e.end_date.split("-").reverse().join("/")}` : ""}{e.provider ? ` · ${e.provider}` : ""}
                    </div>
                  </div>
                  {e.auto && <Badge variant="outline">Automático</Badge>}
                  {e.entry_date > data.today && <Badge variant="secondary">Previsto</Badge>}
                  <div className="text-right">
                    <div className="font-semibold">{ars(e.amount_ars)}</div>
                    {e.currency === "USD" && <div className="text-xs text-muted-foreground">US$ {e.amount} × {e.fx_rate}</div>}
                  </div>
                  {!e.auto && <div className="flex gap-1">
                    {e.frequency !== "once" && !e.end_date && <Button size="sm" variant="ghost" onClick={() => { setPriceFor(e); setPriceForm({ from: data.today, amount: String(e.amount), fx: String(e.fx_rate ?? "") }); }}>Cambiar precio</Button>}
                    <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => setEditing(e)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" aria-label="Eliminar" onClick={() => setToDelete(e)}><Trash2 className="h-4 w-4" /></Button>
                  </div>}
                </div>
              ))}</div>
            )}
            {future.length > 0 && <p className="mt-2 text-xs text-muted-foreground">{future.length} registro(s) previstos a futuro: no suman a los egresos reales hasta su fecha.</p>}
          </CardContent>
        </Card>
      </div>

      <EntryDialog open={editing !== null} entry={editing === "new" ? null : editing} categories={data.categories} today={data.today} onClose={() => setEditing(null)} onSaved={refresh} />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>¿Eliminar «{toDelete?.concept}»?</AlertDialogTitle>
            <AlertDialogDescription>Deja de contar en los cálculos. Queda guardado en el historial de cambios.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => toDelete && delM.mutate(toDelete.id)}>Eliminar</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!priceFor} onOpenChange={(o) => !o && setPriceFor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Nuevo precio de «{priceFor?.concept}»</AlertDialogTitle>
            <AlertDialogDescription>El precio anterior queda registrado hasta el día previo; desde la fecha elegida se usa el nuevo.</AlertDialogDescription></AlertDialogHeader>
          <div className="grid gap-3 sm:grid-cols-3">
            <div><Label>Desde</Label><Input type="date" value={priceForm.from} onChange={(e) => setPriceForm({ ...priceForm, from: e.target.value })} /></div>
            <div><Label>Monto ({priceFor?.currency})</Label><Input inputMode="decimal" value={priceForm.amount} onChange={(e) => setPriceForm({ ...priceForm, amount: e.target.value.replace(",", ".") })} /></div>
            {priceFor?.currency === "USD" && <div><Label>Tipo de cambio</Label><Input inputMode="decimal" value={priceForm.fx} onChange={(e) => setPriceForm({ ...priceForm, fx: e.target.value.replace(",", ".") })} /></div>}
          </div>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><Button disabled={priceM.isPending || !priceForm.amount} onClick={() => priceM.mutate()}>Guardar</Button></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function useUsdRate(entries: FinanceEntry[]) {
  const latest = [...entries].filter((e) => e.currency === "USD" && e.fx_rate).sort((a, b) => b.entry_date.localeCompare(a.entry_date))[0]?.fx_rate ?? 0;
  return useState(latest ? String(latest) : "");
}

function ProfitTab({ data, start, end, fixedNow }: { data: Data; start: string; end: string; fixedNow: number }) {
  const [usd, setUsd] = useUsdRate(data.entries);
  const usdRate = Number(usd) || 0;
  const costPerMsg = WA_USD_PER_MESSAGE * (1 + AR_VAT) * usdRate;
  const active = data.accounts.filter((a) => a.status === "active");
  const basic = active.filter((a) => a.plan === "basic").length;
  const pro = active.length - basic;
  const [mix, setMix] = useState<number | null>(null);

  const cut = end < data.today ? end : data.today;
  const periodMonths = monthsBetween(start, cut);
  const inPeriod = data.incomes.filter((i) => i.date >= start && i.date <= cut);
  const sum = (src: IncomeSource) => inPeriod.filter((i) => i.source === src).reduce((a, i) => a + i.amount, 0);
  const msgs = periodMonths.reduce((a, m) => ({ basic: a.basic + (data.messagesByMonth[m]?.basic ?? 0), pro: a.pro + (data.messagesByMonth[m]?.pro ?? 0) }), { basic: 0, pro: 0 });
  const totalMsgs = msgs.basic + msgs.pro;
  const mrr = basic * data.priceBasic + pro * data.pricePro;
  const collectedPlans = sum("basic") + sum("pro");
  const n = Math.max(1, periodMonths.length);

  // Mensajes por profesional/mes: promedio de los últimos 3 meses completos.
  const last3 = monthsBetween(start, data.today).length ? monthsBetween("2000-01", data.today).slice(-4, -1) : [];
  const msgsLast3 = last3.reduce((a, m) => a + (data.messagesByMonth[m]?.basic ?? 0) + (data.messagesByMonth[m]?.pro ?? 0), 0);
  const msgsPerPro = active.length ? msgsLast3 / Math.max(1, last3.length) / active.length : 0;
  const be = breakEven({ fixedMonthly: fixedNow, basicCount: basic, proCount: pro, priceBasic: data.priceBasic, pricePro: data.pricePro, variablePerPro: msgsPerPro * costPerMsg, mixProShare: mix ?? undefined });

  const thisM = data.today.slice(0, 7);
  const prevM = monthsBetween("2000-01", thisM).slice(-2)[0];
  const incM = (m: string) => data.incomes.filter((i) => monthOf(i.date) === m).reduce((a, i) => a + i.amount, 0);
  const payers = (m: string) => new Set(data.incomes.filter((i) => monthOf(i.date) === m && i.source !== "packs").map((i) => i.professional)).size;
  const growth = (a: number, b: number) => (b > 0 ? (a - b) / b : null);
  const atStart = data.accounts.filter((a) => a.created_at < start).length;
  const churned = new Set(data.churnEvents.filter((e) => e.type === "suspended" && e.date >= start && e.date <= cut).map((e) => e.user_id)).size;
  const overdueUsers = new Set(data.receivables.filter((r) => r.status === "overdue").map((r) => r.user_id)).size;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div><Label className="text-xs">Dólar para costos de WhatsApp (ARS)</Label><Input className="w-44 rounded-xl" inputMode="decimal" placeholder="Ej.: cotización del día" value={usd} onChange={(e) => setUsd(e.target.value.replace(",", "."))} /></div>
        <p className="pb-2 text-xs text-muted-foreground">Costo por mensaje: US$ {WA_USD_PER_MESSAGE} + IVA {AR_VAT * 100}% {usdRate ? `= ${ars(costPerMsg)}` : "(cargá el dólar para calcularlo)"}.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="MRR contratado" value={ars(mrr)} hint="Suscripciones activas × precio vigente del plan. No incluye packs ni pagos extraordinarios." sub={`${basic} Base · ${pro} Pro`} />
        <Kpi label="Cobrado por planes (prom./mes)" value={ars(collectedPlans / n)} hint="Abonos efectivamente cobrados en el período, divididos por la cantidad de meses." />
        <Kpi label="ARPU" value={active.length ? ars(collectedPlans / n / active.length) : "—"} hint="Ingreso promedio mensual por profesional activo (abonos cobrados / meses / activos)." />
        <Kpi label="Ingreso por packs" value={ars(sum("packs"))} hint="Packs adicionales de mensajes cobrados en el período." />
        <Kpi label="Ingreso promedio Base" value={basic ? ars(sum("basic") / n / basic) : "—"} hint="Abonos Base cobrados por mes / profesionales Base activos." />
        <Kpi label="Ingreso promedio Pro" value={pro ? ars(sum("pro") / n / pro) : "—"} hint="Abonos Pro cobrados por mes / profesionales Pro activos." />
        <Kpi label="Rentabilidad Base" value={usdRate ? ars(sum("basic") - msgs.basic * costPerMsg) : "—"} hint="Abonos Base cobrados − costo de los mensajes enviados por cuentas Base en el período." />
        <Kpi label="Rentabilidad Pro" value={usdRate ? ars(sum("pro") - msgs.pro * costPerMsg) : "—"} hint="Abonos Pro cobrados − costo de los mensajes enviados por cuentas Pro en el período." />
        <Kpi label="Costo promedio de recordatorios" value={usdRate && totalMsgs ? ars(costPerMsg) : "—"} hint="Costo total de mensajes / mensajes efectivamente enviados." sub={`${totalMsgs} enviados en el período${usdRate ? ` · ${ars(totalMsgs * costPerMsg)}` : ""}`} />
        <Kpi label="Tasa de morosidad" value={pct(rate(overdueUsers, active.length))} hint="Profesionales con pagos vencidos / profesionales activos con obligación de pago." sub={`${overdueUsers} de ${active.length}`} />
        <Kpi label="Churn" value={pct(rate(churned, atStart))} hint="Cuentas suspendidas en el período / cuentas existentes al inicio del período." sub={`${churned} baja(s)`} />
        <Kpi label="Crecimiento mensual" value={pct(growth(incM(thisM), incM(prevM)))} hint="Variación de ingresos cobrados del mes actual vs. el anterior." sub={`Pagos de profesionales: ${payers(thisM)} vs ${payers(prevM)}`} />
      </div>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle>Punto de equilibrio mensual</CardTitle>
          <CardDescription>Cuántos profesionales pagos cubren los gastos mensuales. Es distinto de recuperar la inversión.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 text-sm sm:grid-cols-4">
            <Fact k="Costo fijo mensual" v={ars(fixedNow)} />
            <Fact k="Margen promedio por profesional" v={ars(be.margin)} />
            <Fact k="Profesionales activos" v={String(be.current)} />
            <Fact k="Necesarios" v={be.needed == null ? "—" : String(be.needed)} />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground"><span>Combinación supuesta: {Math.round((1 - be.proShare) * 100)}% Base · {Math.round(be.proShare * 100)}% Pro</span>{mix != null && <button className="underline" onClick={() => setMix(null)}>Usar la distribución actual</button>}</div>
            <Slider value={[Math.round(be.proShare * 100)]} min={0} max={100} step={5} onValueChange={([v]) => setMix(v / 100)} aria-label="Porcentaje Pro" />
          </div>
          <div className="rounded-2xl bg-primary/10 p-4 text-center font-semibold">
            {fixedNow === 0 ? "Cargá tus gastos recurrentes (mensuales o anuales) para calcular el punto de equilibrio."
              : be.needed == null ? "Con los precios y costos actuales cada profesional no deja margen: no hay punto de equilibrio alcanzable."
              : be.missing === 0 ? `Ya cubrís tus costos operativos mensuales con ${be.current} profesionales.`
              : `Necesitás ${be.missing} profesional${be.missing === 1 ? "" : "es"} pago${be.missing === 1 ? "" : "s"} adicional${be.missing === 1 ? "" : "es"} para cubrir tus costos operativos mensuales.`}
          </div>
          <p className="text-xs text-muted-foreground">Margen = precio vigente del plan − costo variable de mensajes por profesional ({msgsPerPro.toFixed(1)} msj/mes promedio{usdRate ? "" : "; sin dólar cargado se toma costo 0"}).</p>
        </CardContent>
      </Card>
    </div>
  );
}

const SCEN_LABELS = { conservador: "Conservador", base: "Actual", optimista: "Optimista" } as const;
type ScenKey = keyof typeof SCEN_LABELS;

function ProjectionsTab({ data, fixedNow, pending }: { data: Data; fixedNow: number; pending: number }) {
  const [usd] = useUsdRate(data.entries);
  const active = data.accounts.filter((a) => a.status === "active");
  const proShare = active.length ? Math.round((active.filter((a) => a.plan === "pro").length / active.length) * 100) : 50;
  const msgsLast = monthsBetween("2000-01", data.today).slice(-4, -1).reduce((a, m) => a + (data.messagesByMonth[m]?.basic ?? 0) + (data.messagesByMonth[m]?.pro ?? 0), 0) / 3;
  const base: Scenario = {
    active: active.length, newPerMonth: 1, churnPct: 5, proSharePct: proShare, priceBasic: data.priceBasic, pricePro: data.pricePro,
    messagesPerPro: active.length ? Math.round(msgsLast / active.length) : 0, costPerMessage: Math.round(WA_USD_PER_MESSAGE * (1 + AR_VAT) * (Number(usd) || 0) * 100) / 100,
    packsPerMonth: 0, fixedMonthly: fixedNow, variablePerPro: 0,
  };
  const [scen, setScen] = useState<Record<ScenKey, Scenario>>({
    conservador: { ...base, newPerMonth: 0, churnPct: 10 },
    base,
    optimista: { ...base, newPerMonth: 3, churnPct: 2 },
  });
  const [sel, setSel] = useState<ScenKey>("base");
  const cur = scen[sel];
  const res = useMemo(() => Object.fromEntries((Object.keys(scen) as ScenKey[]).map((k) => [k, project(scen[k], 12, pending)])) as Record<ScenKey, ReturnType<typeof project>>, [scen, pending]);
  const set = (k: keyof Scenario, v: string) => setScen({ ...scen, [sel]: { ...cur, [k]: Number(v.replace(",", ".")) || 0 } });
  const fields: [keyof Scenario, string][] = [
    ["active", "Profesionales activos hoy"], ["newPerMonth", "Nuevos por mes"], ["churnPct", "Cancelaciones mensuales (%)"], ["proSharePct", "Proporción Pro (%)"],
    ["priceBasic", "Precio Base"], ["pricePro", "Precio Pro"], ["messagesPerPro", "Mensajes por profesional/mes"], ["costPerMessage", "Costo por mensaje (ARS)"],
    ["packsPerMonth", "Packs vendidos por mes (ARS)"], ["fixedMonthly", "Costos fijos mensuales"], ["variablePerPro", "Otros costos variables por profesional"],
  ];

  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">Las proyecciones son estimaciones con los supuestos de abajo. No se mezclan con los datos reales.</p>
      <div className="flex flex-wrap gap-2">{(Object.keys(SCEN_LABELS) as ScenKey[]).map((k) => <Button key={k} variant={sel === k ? "default" : "outline"} className="rounded-xl" onClick={() => setSel(k)}>{SCEN_LABELS[k]}</Button>)}</div>
      <Card className="rounded-2xl"><CardContent className="grid gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4">
        {fields.map(([k, label]) => <div key={k}><Label className="text-xs">{label}</Label><Input className="rounded-xl" inputMode="decimal" value={String(cur[k])} onChange={(e) => set(k, e.target.value)} /></div>)}
      </CardContent></Card>
      <div className="grid gap-3 md:grid-cols-3">
        {(Object.keys(SCEN_LABELS) as ScenKey[]).map((k) => (
          <Card key={k} className={`rounded-2xl ${k === sel ? "border-primary" : ""}`}>
            <CardHeader className="pb-2"><CardTitle className="text-base">{SCEN_LABELS[k]}</CardTitle>
              <CardDescription>Recuperación total: {res[k].recoveryMonth === 0 ? "ya alcanzada" : res[k].recoveryMonth ? estimateDate(data.today, res[k].recoveryMonth!) : "no dentro de 12 meses"}</CardDescription></CardHeader>
            <CardContent><table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground"><tr><th className="text-left">Mes</th><th className="text-right">Ingresos</th><th className="text-right">Gastos</th><th className="text-right">Neto</th><th className="text-right">Activos</th></tr></thead>
              <tbody>{[3, 6, 12].map((m) => { const r = res[k].rows[m - 1]; return (
                <tr key={m} className="border-t border-border"><td className="py-1">{m}</td><td className="text-right">{ars(r.income)}</td><td className="text-right">{ars(r.expenses)}</td><td className={`text-right font-medium ${r.net >= 0 ? "text-chart-2" : "text-destructive"}`}>{ars(r.net)}</td><td className="text-right">{Math.round(r.active)}</td></tr>
              ); })}</tbody>
            </table></CardContent>
          </Card>
        ))}
      </div>
      <div className="flex justify-end">
        <Button variant="outline" className="rounded-xl" onClick={() => download(`agendera-proyeccion-${sel}.csv`, [["Mes", "Activos", "Ingresos", "Gastos", "Neto", "Neto acumulado"], ...res[sel].rows.map((r) => [r.month, r.active, r.income, r.expenses, r.net, r.cumNet])])}><Download className="mr-2 h-4 w-4" />Exportar CSV</Button>
      </div>
    </div>
  );
}
