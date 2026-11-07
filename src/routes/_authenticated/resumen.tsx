import { createFileRoute, type ErrorComponentProps } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMonthlySummary } from "@/lib/api/stats.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, Users, XCircle, CheckCircle2, UserX, RefreshCw, Award, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { RetentionNotice } from "@/components/RetentionNotice";
import { MessagesTab, PaymentsTab } from "@/components/summary/MessagesTabs";

export const Route = createFileRoute("/_authenticated/resumen")({
  component: SummaryPage,
  validateSearch: (search: Record<string, unknown>): { tab: SummaryTab } => {
    const t = String(search.tab ?? "general");
    return { tab: (["general", "mensajes", "pagos"].includes(t) ? t : "general") as SummaryTab };
  },
  head: () => ({
    meta: [
      { title: "Resumen del mes | Agendera — La agenda que se maneja sola" },
      { name: "description", content: "Mirá las métricas del mes: turnos, asistencia y actividad de tu consultorio." },
      { property: "og:title", content: "Resumen del mes | Agendera — La agenda que se maneja sola" },
      { property: "og:description", content: "Mirá las métricas del mes: turnos, asistencia y actividad de tu consultorio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: ({ error }: ErrorComponentProps) => <div role="alert" className="text-sm text-destructive">{error instanceof Error ? error.message : String(error)}</div>,
  notFoundComponent: () => <div>Sin datos.</div>,
});

const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const DAY_INDEX = [1, 2, 3, 4, 5, 6, 0];

function delta(cur: number, prev: number) {
  if (prev === 0) return cur === 0 ? "sin cambios" : `+${cur} vs mes anterior`;
  const pct = Math.round(((cur - prev) / prev) * 100);
  return `${pct >= 0 ? "+" : ""}${pct}% vs mes anterior`;
}

function timeAgo(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.round(hours / 24)} d`;
}

function RankingCard({
  title,
  icon: Icon,
  tone,
  empty,
  unit,
  rows,
}: {
  title: string;
  icon: any;
  tone: string;
  empty: string;
  unit: string;
  rows: { name: string; value: number }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className={`h-4 w-4 ${tone}`} strokeWidth={2.5} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">{empty}</p>}
        {rows.map((r, i) => (
          <div key={r.name + i} className="flex items-center justify-between gap-3 text-sm">
            <div className="flex min-w-0 items-center gap-2">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">
                {i + 1}
              </span>
              <span className="truncate">{r.name}</span>
            </div>
            <span className={`shrink-0 font-semibold ${tone}`}>
              {r.value} {unit}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

const ars = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function IncomeCard({ data }: { data: { income: number; incomePrev: number; incomeByMonth: { month: number; total: number }[] } }) {
  const diff = data.income - data.incomePrev;
  const up = diff >= 0;
  const pct = data.incomePrev > 0 ? Math.round((diff / data.incomePrev) * 100) : null;
  const chart = data.incomeByMonth.map((m) => ({ name: MONTHS[m.month], total: m.total }));
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-base">Ingresos del mes</CardTitle>
          <div className="mt-2 text-3xl font-bold">{ars.format(data.income)}</div>
          <div className={`mt-1 flex items-center gap-1 text-xs ${up ? "text-secondary" : "text-destructive"}`}>
            {up ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            {pct === null ? (data.income > 0 ? "Primer mes con ingresos" : "Sin ingresos") : `${up ? "+" : ""}${pct}% vs mes anterior`}
          </div>
        </div>
        <Wallet className="h-5 w-5 text-primary" strokeWidth={2.5} />
      </CardHeader>
      <CardContent>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} stroke="hsl(var(--muted-foreground))" />
              <YAxis tickLine={false} axisLine={false} fontSize={11} width={84} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => ars.format(v)} />
              <Tooltip formatter={(v: number) => [ars.format(v), "Ingresos"]} />
              <Bar dataKey="total" name="Ingresos" radius={[6, 6, 0, 0]} maxBarSize={44} style={{ fill: "var(--primary)" }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Suma del precio de cada tipo de turno en turnos no cancelados. Los tipos sin precio no suman.</p>
      </CardContent>
    </Card>
  );
}

type SummaryTab = "general" | "mensajes" | "pagos";
const SUMMARY_TABS: { id: SummaryTab; label: string }[] = [
  { id: "general", label: "Resumen general" },
  { id: "mensajes", label: "Mensajes y Packs" },
  { id: "pagos", label: "Mis pagos" },
];

function SummaryPage() {
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <div className="zip-ui warm-ui space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-heading">Resumen del mes</h1>
      </header>
      <div className="mk-status-seg" role="tablist" aria-label="Secciones del resumen">
        {SUMMARY_TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? "is-active" : undefined} onClick={() => navigate({ search: { tab: t.id } })}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "general" && <GeneralSummary />}
      {tab === "mensajes" && <MessagesTab />}
      {tab === "pagos" && <PaymentsTab />}
    </div>
  );
}

function GeneralSummary() {
  const fn = useServerFn(getMonthlySummary);
  const now = new Date();
  const { data, isLoading } = useQuery({
    queryKey: ["monthly-summary", now.getFullYear(), now.getMonth()],
    queryFn: () => fn({ data: { month: now.getMonth(), year: now.getFullYear() } }),
  });

  const monthLabel = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(now);

  const cards = data
    ? [
        { label: "Turnos este mes", value: String(data.appointments), sub: delta(data.appointments, data.appointmentsPrev), icon: CalendarDays, tone: "text-[hsl(var(--day-1,220_60%_50%))]" },
        { label: "Pacientes activos", value: String(data.patients), sub: delta(data.patients, data.patientsPrev), icon: Users, tone: "text-primary" },
        { label: "Cancelaciones", value: String(data.cancellations), sub: delta(data.cancellations, data.cancellationsPrev), icon: XCircle, tone: "text-destructive" },
        {
          label: "Tasa de asistencia",
          value: data.attendanceRate === null ? "—" : `${data.attendanceRate}%`,
          sub: data.attendanceRate === null ? "sin turnos marcados" : delta(data.attendanceRate, data.attendanceRatePrev ?? data.attendanceRate),
          icon: CheckCircle2,
          tone: "text-emerald-600",
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground capitalize">Resumen general del consultorio · {monthLabel}</p>

      <RetentionNotice />

      {isLoading && <p className="text-sm text-muted-foreground">Cargando métricas…</p>}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((c) => (
              <Card key={c.label}>
                <CardContent className="space-y-1 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm text-muted-foreground">{c.label}</span>
                    <c.icon className={`h-5 w-5 ${c.tone}`} strokeWidth={2.5} />
                  </div>
                  <div className="text-3xl font-bold">{c.value}</div>
                  <div className="text-xs text-muted-foreground">{c.sub}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <IncomeCard data={data} />

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Turnos por día de la semana (histórico)</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {DAY_INDEX.map((idx, i) => {
                  const value = data.byWeekday[idx] ?? 0;
                  const pct = Math.round((value / data.maxWeekday) * 100);
                  return (
                    <div key={idx} className="flex items-center gap-3 text-sm">
                      <span className="w-20 shrink-0 text-muted-foreground">{DAYS[i]}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-12 shrink-0 text-right text-muted-foreground">{value}/{data.maxWeekday}</span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Actividad reciente</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {data.recent.length === 0 && <p className="text-sm text-muted-foreground">Sin actividad todavía.</p>}
                {data.recent.map((r, i) => (
                  <div key={i} className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                          r.kind === "cancelled" ? "bg-destructive" : r.kind === "patient" ? "bg-primary" : "bg-emerald-500"
                        }`}
                      />
                      <div className="leading-tight">
                        <div className="text-sm font-semibold">{r.label}</div>
                        <div className="text-xs text-muted-foreground">{r.name}</div>
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(r.at)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <RankingCard
              title="Más ausencias (histórico)"
              icon={UserX}
              tone="text-destructive"
              unit="aus."
              empty="Sin ausencias registradas todavía."
              rows={data.topAbsences ?? []}
            />
            <RankingCard
              title="Más reprogramaciones (histórico)"
              icon={RefreshCw}
              tone="text-amber-600"
              unit="rep."
              empty="Sin reprogramaciones todavía."
              rows={data.topReschedules ?? []}
            />
            <RankingCard
              title="Más asistencias (histórico)"
              icon={Award}
              tone="text-emerald-600"
              unit="asist."
              empty="Sin asistencias marcadas todavía."
              rows={data.topAttended ?? []}
            />
          </div>
        </>
      )}
    </div>
  );
}
