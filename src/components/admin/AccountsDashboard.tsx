import { matchesSearch } from "@/lib/search";
import { PaymentReminderStatus } from "@/components/admin/PaymentReminderStatus";
import { compareByName } from "@/lib/sort";
import { getBilling } from "@/lib/api/billing.functions";
import { previousPeriod, todayAR } from "@/lib/billing";
import { useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { addPayment, deleteAccount, getAccountDetail, listAccounts, listWhatsappSpendHistory } from "@/lib/api/admin.functions";
import { PLAN_LABELS } from "@/lib/entitlements";
import { monthKeyAR, paidThisMonth, SETUP_LABELS, type SetupChecks } from "@/lib/adminMetrics";
import { AR_VAT, WA_USD_PER_MESSAGE, whatsappCost } from "@/lib/whatsappCost";

const ars = (n: number) => n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });

function useUsdRate() {
  return useQuery({
    queryKey: ["usd-ars-oficial"],
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const r = await fetch("https://dolarapi.com/v1/dolares/oficial");
      if (!r.ok) throw new Error("rate");
      const j = (await r.json()) as { venta: number; fechaActualizacion: string };
      return j;
    },
  });
}

function WhatsappCostCard({ messages }: { messages: number }) {
  const { data: rate, isError } = useUsdRate();
  const c = whatsappCost(messages, rate?.venta ?? null);
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-medium">Gasto estimado en WhatsApp</p>
          <p className="text-2xl font-semibold">{c.arsTotal != null ? ars(c.arsTotal) : "—"}</p>
        </div>
        <p className="text-xs text-muted-foreground">
          {messages} mensajes × US$ {WA_USD_PER_MESSAGE.toLocaleString("es-AR")} = US${" "}
          {c.usd.toLocaleString("es-AR", { maximumFractionDigits: 2 })}
          {rate && c.arsNet != null && c.vat != null && (
            <>
              {" "}· Dólar oficial (venta) {ars(rate.venta)} → {ars(c.arsNet)} + IVA {AR_VAT * 100}% {ars(c.vat)}
            </>
          )}
          {isError && " · No se pudo obtener la cotización del día."}
          {!rate && !isError && " · Cargando cotización…"}
        </p>
      </CardContent>
    </Card>
  );
}

function CostCell({ messages }: { messages: number }) {
  const { data: rate } = useUsdRate();
  const c = whatsappCost(messages, rate?.venta ?? null);
  if (messages === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <span title={`${messages} mensajes × US$ ${WA_USD_PER_MESSAGE.toLocaleString("es-AR")} + IVA ${AR_VAT * 100}%`}>
      {c.arsTotal != null ? ars(c.arsTotal) : "—"}
    </span>
  );
}

export type Account = Awaited<ReturnType<typeof listAccounts>>[number];

const STATE_LABELS = { pending: "Pendiente de aprobación", active: "Activa", suspended: "Suspendida" } as const;
const CONN_TONE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ok: "default",
  unverified: "outline",
  problem: "destructive",
  disconnected: "secondary",
};
const CAL_TONE_CLASS: Record<string, string> = {
  ok: "conn-ok",
  disconnected: "conn-off",
};
const ATTEMPT_LABELS: Record<string, string> = {
  sent: "Aceptado por Meta",
  delivered: "Entregado",
  read: "Leído",
  failed: "Fallido",
};

const TZ = "America/Argentina/Buenos_Aires";
function fmtDate(v: string | null | undefined) {
  if (!v) return "—";
  return new Date(v.length === 10 ? `${v}T12:00:00` : v).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: TZ,
  });
}
function fmtDateTime(v: string | null | undefined) {
  if (!v) return "—";
  return new Date(v).toLocaleString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  });
}
function lastMonths(n: number) {
  const out: { value: string; label: string }[] = [];
  const base = monthKeyAR(new Date());
  let [y, m] = base.split("-").map(Number);
  for (let i = 0; i < n; i++) {
    const value = `${y}-${String(m).padStart(2, "0")}`;
    const label = new Date(y, m - 1, 15).toLocaleDateString("es-AR", { month: "long", year: "numeric" });
    out.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  return out;
}

export type AccountMetric = "all" | "active" | "new" | "setup" | "inactive";

const METRIC_TITLES: Record<AccountMetric, string> = {
  all: "Todas las cuentas",
  active: "Cuentas activas",
  new: "Nuevas altas",
  setup: "Pendientes de configuración",
  inactive: "Sin actividad reciente",
};

export function AccountsDashboard({
  metric,
  onEdit,
  onToggleStatus,
}: {
  metric: AccountMetric;
  onEdit: (a: Account) => void;
  onToggleStatus: (a: Account) => void;
}) {
  const months = useMemo(() => lastMonths(12), []);
  const [pickedMonth, setMonth] = useState(months[0].value);
  const [view, setView] = useState<"accounts" | "reminders" | "history">("accounts");
  // WhatsApp spend always shows the current month; it resets when a new month starts.
  const month = view === "accounts" ? pickedMonth : months[0].value;
  const fetchAccounts = useServerFn(listAccounts);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-accounts", month],
    queryFn: () => fetchAccounts({ data: { month } }),
  });

  const [search, setSearch] = useState("");
  const [remSearch, setRemSearch] = useState("");
  const [stateF, setStateF] = useState("all");
  const [planF, setPlanF] = useState("all");
  const [setupF, setSetupF] = useState("all");
  const [connF, setConnF] = useState("all");
  const [payF, setPayF] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [detail, setDetail] = useState<Account | null>(null);

  const activeFilters = [stateF, planF, setupF, connF, payF].filter((v) => v !== "all").length;
  const clearFilters = () => {
    setStateF("all");
    setPlanF("all");
    setSetupF("all");
    setConnF("all");
    setPayF("all");
  };

  const all = (data ?? []) as Account[];
  const isNew = (a: Account) => !!a.approved_at && monthKeyAR(new Date(a.approved_at)) === month;
  const pendingSetup = (a: Account) => !!a.last_sign_in_at && !a.setup_done && !a.is_admin;

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = all.filter((a) => {
      if (metric === "active" && a.state !== "active") return false;
      if (metric === "new" && !isNew(a)) return false;
      if (metric === "setup" && !pendingSetup(a)) return false;
      if (metric === "inactive" && !a.inactive) return false;
      if (stateF !== "all" && a.state !== stateF) return false;
      if (planF !== "all" && a.plan !== planF) return false;
      if (setupF === "done" && !a.setup_done) return false;
      if (setupF === "pending" && a.setup_done) return false;
      if (connF === "whatsapp" && a.whatsapp.state === "ok") return false;
      if (connF === "calendar" && a.calendar.state === "ok") return false;
      if (connF === "problem" && a.whatsapp.state !== "problem" && a.calendar.state !== "problem") return false;
      if (payF === "paid" && !paidThisMonth(a.last_payment_at)) return false;
      if (payF === "unpaid" && paidThisMonth(a.last_payment_at)) return false;
      if (!q) return true;
      return matchesSearch(q, a.email, a.display_name, a.phone);
    });
    // New accounts still configuring first, then inactive, then lowest activity this month.
    const rank = (a: Account) => (pendingSetup(a) ? 0 : a.inactive ? 1 : 2);
    return list.sort(
      (x, y) =>
        compareByName(x.display_name || x.email, y.display_name || y.email),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, search, metric, stateF, planF, setupF, connF, payF, month]);

  const remRows = all.filter((a) => matchesSearch(remSearch, a.email, a.display_name, a.phone));

  const totals = all.reduce(
    (t, a) => ({
      attempts: t.attempts + a.reminders.attempts + a.reminders.legacySent,
      sent: t.sent + a.reminders.sent,
      delivered: t.delivered + a.reminders.delivered,
      failed: t.failed + a.reminders.failed,
      legacy: t.legacy + a.reminders.legacySent,
    }),
    { attempts: 0, sent: 0, delivered: 0, failed: 0, legacy: 0 },
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            className="rounded-xl"
            variant={view === "accounts" ? "default" : "outline"}
            onClick={() => setView("accounts")}
          >
            Seguimiento
          </Button>
          <Button
            size="sm"
            className="rounded-xl"
            variant={view === "reminders" ? "default" : "outline"}
            onClick={() => setView("reminders")}
          >
            Recordatorios de WhatsApp enviados
          </Button>
          <Button
            size="sm"
            className="rounded-xl"
            variant={view === "history" ? "default" : "outline"}
            onClick={() => setView("history")}
          >
            Historial de gastos
          </Button>
        </div>
        {view === "accounts" ? (
        <Select value={pickedMonth} onValueChange={setMonth}>
          <SelectTrigger className="w-full sm:w-52" aria-label="Período">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        ) : view === "reminders" ? (
          <Badge variant="outline">Mes en curso · {months[0].label}</Badge>
        ) : null}
      </div>

      {view === "history" ? (
        <WhatsappHistory months={months} />
      ) : error ? (
        <p className="text-sm text-destructive">No pudimos cargar las cuentas: {(error as Error).message}</p>
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando cuentas…</p>
      ) : view === "accounts" ? (
        <>
          <h2 className="text-xl font-bold tracking-tight">{METRIC_TITLES[metric]}</h2>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center [&>button]:w-full sm:[&>button]:w-auto [&>button]:min-w-0">
            <Input
              placeholder="Buscar por nombre, email o teléfono…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="col-span-2 sm:max-w-xs"
            />
            <Button
              type="button"
              variant="outline"
              className="col-span-2 sm:col-span-1"
              onClick={() => setFiltersOpen(true)}
            >
              <SlidersHorizontal className="size-4" />
              Filtros
              {activeFilters > 0 && (
                <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-xs font-semibold text-primary-foreground">
                  {activeFilters}
                </span>
              )}
            </Button>
          </div>

          <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Filtros</DialogTitle>
                <DialogDescription>Combiná los criterios para encontrar cuentas.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-3">
                <label className="grid gap-1 text-sm font-medium">
                  Estado
                  <Filter
                    value={stateF}
                    onChange={setStateF}
                    label="Estado"
                    options={[
                      ["all", "Todos los estados"],
                      ["active", "Activa"],
                      ["pending", "Pendiente de aprobación"],
                      ["suspended", "Suspendida"],
                    ]}
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  Plan
                  <Filter
                    value={planF}
                    onChange={setPlanF}
                    label="Plan"
                    options={[
                      ["all", "Todos los planes"],
                      ["basic", "Base"],
                      ["pro", "Pro"],
                    ]}
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  Configuración
                  <Filter
                    value={setupF}
                    onChange={setSetupF}
                    label="Configuración"
                    options={[
                      ["all", "Toda configuración"],
                      ["done", "Completa"],
                      ["pending", "Pendiente"],
                    ]}
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  Conexiones
                  <Filter
                    value={connF}
                    onChange={setConnF}
                    label="Conexiones"
                    options={[
                      ["all", "Todas las conexiones"],
                      ["whatsapp", "WhatsApp sin operar"],
                      ["calendar", "Calendar sin operar"],
                      ["problem", "Con problemas"],
                    ]}
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  Pagos
                  <Filter
                    value={payF}
                    onChange={setPayF}
                    label="Pagos"
                    options={[
                      ["all", "Todos los pagos"],
                      ["paid", "Pagaron este mes"],
                      ["unpaid", "No pagaron este mes"],
                    ]}
                  />
                </label>
              </div>
              <div className="flex items-center justify-between gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={clearFilters} disabled={activeFilters === 0}>
                  Limpiar filtros
                </Button>
                <Button type="button" onClick={() => setFiltersOpen(false)}>
                  Ver {rows.length} {rows.length === 1 ? "cuenta" : "cuentas"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay cuentas que coincidan.</p>
          ) : (
            <>
              <ul className="space-y-3 md:hidden">
                {rows.map((a) => (
                  <li key={a.user_id}>
                    <button
                      type="button"
                      onClick={() => setDetail(a)}
                      className="w-full min-w-0 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-primary"
                    >
                      <span className="block truncate font-semibold">{a.display_name || "Sin nombre"}</span>
                      <span className="block truncate text-xs text-muted-foreground">{a.email}</span>
                      <span className="mt-2 flex flex-wrap gap-1.5">
                        <Badge
                          variant={
                            a.state === "active" ? "outline" : a.state === "suspended" ? "destructive" : "secondary"
                          }
                        >
                          {STATE_LABELS[a.state]}
                        </Badge>
                        <Badge variant="outline">{PLAN_LABELS[a.plan]}</Badge>
                        <Badge variant="outline" className={a.setup_done ? "conn-ok" : "conn-bad"}>
                          Config. {a.setup_done ? "completa" : "pendiente"}
                        </Badge>
                      </span>
                      <span className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <span className="min-w-0">
                          <span className="block text-muted-foreground">Turnos del mes</span>
                          <span className="block font-heading text-lg font-bold tabular-nums">
                            {a.metrics.monthCreated}
                          </span>
                        </span>
                        <span className="min-w-0">
                          <span className="block text-muted-foreground">Último ingreso</span>
                          <span className="block font-medium">
                            {a.last_sign_in_at ? fmtDate(a.last_sign_in_at) : "Nunca"}
                          </span>
                        </span>
                      </span>
                      <span className="mt-3 flex flex-wrap gap-1.5">
                        {false && (
                          <Badge variant={CONN_TONE[a.whatsapp.state]} className="max-w-full truncate">
                            WA · {a.whatsapp.detail}
                          </Badge>
                        )}
                        <Badge variant={CONN_TONE[a.calendar.state]} className={`max-w-full truncate ${CAL_TONE_CLASS[a.calendar.state] ?? ""}`}>
                          Cal · {a.calendar.detail}
                        </Badge>
                      </span>
                      {a.inactive && (
                        <span className="mt-2 block text-xs text-muted-foreground">Sin actividad reciente</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="hidden overflow-x-auto rounded-2xl border border-border bg-card md:block">
                <table className="w-full min-w-[960px] text-sm">
                  <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                    <tr>
                      {[
                        "Profesional",
                        "Estado",
                        "Plan",
                        "Último ingreso",
                        "Configuración",
                        "Turnos creados",
                        "Conexiones",
                      ].map((h) => (
                        <th key={h} className="px-3 py-2.5 font-semibold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((a) => (
                      <tr
                        key={a.user_id}
                        onClick={() => setDetail(a)}
                        className="cursor-pointer border-t border-border hover:bg-accent/40"
                      >
                        <td className="px-3 py-2.5">
                          <span className="block font-semibold">{a.display_name || "Sin nombre"}</span>
                          <span className="block text-xs text-muted-foreground">{a.email}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge
                            variant={
                              a.state === "active" ? "outline" : a.state === "suspended" ? "destructive" : "secondary"
                            }
                          >
                            {STATE_LABELS[a.state]}
                          </Badge>
                          {a.inactive && (
                            <span className="mt-1 block text-xs text-muted-foreground">Sin actividad</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">{PLAN_LABELS[a.plan]}</td>
                        <td className="px-3 py-2.5">{a.last_sign_in_at ? fmtDate(a.last_sign_in_at) : "Nunca"}</td>
                        <td className="px-3 py-2.5">
                          <Badge variant="outline" className={a.setup_done ? "conn-ok" : "conn-bad"}>
                            {a.setup_done ? "Completa" : "Pendiente"}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 tabular-nums">{a.metrics.monthCreated}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-col gap-1">
                            {false && (
                              <Badge variant={CONN_TONE[a.whatsapp.state]} className="w-fit">
                                WA · {a.whatsapp.detail}
                              </Badge>
                            )}
                            <Badge variant={CONN_TONE[a.calendar.state]} className={`w-fit ${CAL_TONE_CLASS[a.calendar.state] ?? ""}`}>
                              Cal · {a.calendar.detail}
                            </Badge>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Intentos de envío" value={totals.attempts} hint="Incluye los primeros enviados" />
            <Stat label="Aceptados por Meta" value={totals.sent} hint="Enviados sin error" />
            <Stat label="Entregados" value={totals.delivered} hint="Confirmados por WhatsApp" />
            <Stat label="Fallidos" value={totals.failed} hint="Rechazados al enviar o al entregar" />
          </div>
          <WhatsappCostCard messages={totals.sent + totals.legacy} />
          <Input
            placeholder="Buscar por nombre, email o teléfono…"
            value={remSearch}
            onChange={(e) => setRemSearch(e.target.value)}
            className="sm:max-w-xs"
          />
          
          <ul className="space-y-3 md:hidden">
            {remRows
              .sort(
                (x, y) =>
                  compareByName(x.display_name || x.email, y.display_name || y.email),
              )
              .map((a) => (
                <li key={a.user_id}>
                  <button
                    type="button"
                    onClick={() => setDetail(a)}
                    className="w-full min-w-0 rounded-2xl border border-border bg-card p-4 text-left hover:border-primary"
                  >
                    <span className="block truncate font-semibold">{a.display_name || a.email}</span>
                    <span className="mt-2 grid grid-cols-4 gap-2 text-center text-xs tabular-nums">
                      {(
                        [
                          ["Intentos", a.reminders.attempts + a.reminders.legacySent],
                          ["Aceptados", a.reminders.sent],
                          ["Entregados", a.reminders.delivered],
                          ["Fallidos", a.reminders.failed],
                        ] as const
                      ).map(([l, v]) => (
                        <span key={l} className="min-w-0">
                          <span className="block font-heading text-lg font-bold">{v}</span>
                          <span className="block truncate text-muted-foreground">{l}</span>
                        </span>
                      ))}
                    </span>
                    <span className="mt-2 block text-xs text-muted-foreground">
                      Último enviado: {fmtDateTime(a.reminders.lastSentAt)} · Gasto:{" "}
                      <CostCell messages={a.reminders.sent + a.reminders.legacySent} />
                    </span>
                  </button>
                </li>
              ))}
          </ul>
          <div className="hidden overflow-x-auto rounded-2xl border border-border bg-card md:block">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  {[
                    "Profesional",
                    "Intentos",
                    "Aceptados",
                    "Entregados",
                    "Fallidos",
                    "Gasto",
                    "Último enviado",
                  ].map((h) => (
                    <th key={h} className="px-3 py-2.5 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {remRows
                  .sort(
                    (x, y) =>
                      compareByName(x.display_name || x.email, y.display_name || y.email),
                  )
                  .map((a) => (
                    <tr
                      key={a.user_id}
                      onClick={() => setDetail(a)}
                      className="cursor-pointer border-t border-border tabular-nums hover:bg-accent/40"
                    >
                      <td className="px-3 py-2.5 font-semibold">{a.display_name || a.email}</td>
                      <td className="px-3 py-2.5">{a.reminders.attempts + a.reminders.legacySent}</td>
                      <td className="px-3 py-2.5">{a.reminders.sent}</td>
                      <td className="px-3 py-2.5">{a.reminders.delivered}</td>
                      <td className="px-3 py-2.5">{a.reminders.failed}</td>
                      <td className="px-3 py-2.5">
                        <CostCell messages={a.reminders.sent + a.reminders.legacySent} />
                      </td>
                      <td className="px-3 py-2.5">{fmtDateTime(a.reminders.lastSentAt)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <DetailDialog
        account={detail ? (all.find((a) => a.user_id === detail.user_id) ?? detail) : null}
        month={month}
        monthLabel={months.find((m) => m.value === month)?.label ?? month}
        onClose={() => setDetail(null)}
        onEdit={onEdit}
        onToggleStatus={onToggleStatus}
      />
    </div>
  );
}

function Filter({
  value,
  onChange,
  label,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  options: [string, string][];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(([v, l]) => (
          <SelectItem key={v} value={v}>
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <span className="block text-xs font-semibold text-muted-foreground">{label}</span>
      <span className="mt-1 block font-heading text-3xl font-bold tabular-nums">{value}</span>
      <span className="block text-xs text-muted-foreground">{hint}</span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-2 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}

function DetailDialog({
  account,
  month,
  monthLabel,
  onClose,
  onEdit,
  onToggleStatus,
}: {
  account: Account | null;
  month: string;
  monthLabel: string;
  onClose: () => void;
  onEdit: (a: Account) => void;
  onToggleStatus: (a: Account) => void;
}) {
  const fetchDetail = useServerFn(getAccountDetail);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-account-detail", account?.user_id, month],
    queryFn: () => fetchDetail({ data: { user_id: account!.user_id, month } }),
    enabled: !!account,
  });

  const timeline = useMemo(() => {
    if (!account) return [];
    const items = (data?.events ?? []).map((e) => ({
      at: e.created_at as string,
      type: e.event_type as string,
      description: e.description as string,
      actor: e.actor_email as string,
    }));
    if (account.requested_at)
      items.push({ at: account.requested_at, type: "request", description: "Solicitud de acceso creada", actor: "" });
    if (account.approved_at)
      items.push({ at: account.approved_at, type: "approved", description: "Solicitud aprobada", actor: "" });
    return items.sort((x, y) => y.at.localeCompare(x.at));
  }, [account, data]);

  return (
    <Dialog open={!!account} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[44rem]">
        {account && (
          <>
            <DialogHeader>
              <DialogTitle>{account.display_name || account.email}</DialogTitle>
              <DialogDescription>{account.email}</DialogDescription>
            </DialogHeader>
            <Tabs defaultValue="summary">
              <TabsList className="flex h-auto flex-wrap">
                <TabsTrigger value="summary">Resumen</TabsTrigger>
                <TabsTrigger value="activity">Actividad</TabsTrigger>
                <TabsTrigger value="reminders">Recordatorios</TabsTrigger>
                <TabsTrigger value="connections">Conexiones</TabsTrigger>
                <TabsTrigger value="history">Historial</TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="space-y-3">
                <div>
                  <Row label="Estado" value={STATE_LABELS[account.state]} />
                  <Row label="Plan" value={PLAN_LABELS[account.plan]} />
                  <Row label="Alta en la plataforma" value={fmtDate(account.created_at)} />
                  <Row label="Aprobación" value={fmtDate(account.approved_at)} />
                  <Row
                    label="Último ingreso"
                    value={account.last_sign_in_at ? fmtDateTime(account.last_sign_in_at) : "Nunca"}
                  />
                  <Row
                    label="Vencimiento del plan"
                    value={`${fmtDate(account.expires_at)}${account.expired ? " · vencido" : ""}`}
                  />
                  <Row label="Último pago" value={fmtDate(account.last_payment_at)} />
                </div>
                <div className="rounded-xl border border-border p-3">
                  <p className="mb-2 text-sm font-semibold">
                    Configuración inicial {account.setup_done ? "completa" : "pendiente"}
                  </p>
                  <ul className="grid gap-1 text-sm sm:grid-cols-2">
                    {(Object.keys(SETUP_LABELS) as (keyof SetupChecks)[]).map((k) => (
                      <li key={k} className={account.setup[k] ? "" : "text-muted-foreground"}>
                        {account.setup[k] ? "✓" : "○"} {SETUP_LABELS[k]}
                      </li>
                    ))}
                  </ul>
                </div>
                <PaymentForm account={account} payments={data?.payments ?? []} />
                <div className="flex flex-wrap justify-end gap-2">
                  {!account.is_admin && (
                    <Button variant="outline" onClick={() => onToggleStatus(account)}>
                      {account.status === "suspended" ? "Reactivar" : "Suspender"}
                    </Button>
                  )}
                  <Button onClick={() => onEdit(account)}>Administrar plan</Button>
                </div>
                {!account.is_admin && <DeleteAccountButton account={account} onDone={onClose} />}
              </TabsContent>

              <TabsContent value="activity">
                <Row label="Pacientes" value={account.metrics.patients} />
                <Row label={`Turnos creados en ${monthLabel}`} value={account.metrics.monthCreated} />
                <Row label="Turnos activos a futuro" value={account.metrics.activeAppointments} />
                <Row label="Último turno creado" value={fmtDateTime(account.metrics.lastCreatedAt)} />
                <Row label="Último turno programado" value={fmtDateTime(account.metrics.lastScheduledAt)} />
                <Row
                  label="Sin actividad en 30 días"
                  value={account.setup_done ? (account.inactive ? "Sí" : "No") : "No aplica (configurando)"}
                />
              </TabsContent>

              <TabsContent value="reminders" className="space-y-2">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Stat label="Intentos" value={account.reminders.attempts + account.reminders.legacySent} hint={monthLabel} />
                  <Stat label="Aceptados" value={account.reminders.sent} hint="Por Meta" />
                  <Stat label="Entregados" value={account.reminders.delivered} hint="Confirmados" />
                  <Stat label="Fallidos" value={account.reminders.failed} hint="Con error" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Gasto estimado:{" "}
                  <CostCell messages={account.reminders.sent + account.reminders.legacySent} />
                </p>
                {account.reminders.legacySent > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {account.reminders.legacySent} enviados antes de registrar intentos (sin dato de entrega).
                  </p>
                )}
                {isLoading ? (
                  <p className="text-sm text-muted-foreground">Cargando…</p>
                ) : (data?.attempts ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin intentos registrados en el mes.</p>
                ) : (
                  <ul className="divide-y divide-border rounded-xl border border-border text-sm">
                    {data!.attempts.map((t) => (
                      <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                        <span>
                          {fmtDateTime(t.created_at)} · {t.trigger === "manual" ? "Manual" : "Automático"}
                          {t.appointment_start && (
                            <span className="text-muted-foreground"> · turno {fmtDateTime(t.appointment_start)}</span>
                          )}
                          {t.error && <span className="block text-xs text-destructive">{t.error}</span>}
                        </span>
                        <Badge variant={t.status === "failed" ? "destructive" : "outline"}>
                          {ATTEMPT_LABELS[t.status] ?? t.status}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="connections" className="space-y-3">
                {(
                  [
                    ["WhatsApp", account.whatsapp, "Último envío correcto"],
                    ["Google Calendar", account.calendar, "Última sincronización"],
                  ] as const
                ).map(([name, c, lastLabel]) => (
                  <Card key={name}>
                    <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
                      <div>
                        <p className="font-semibold">{name}</p>
                        <p className="text-xs text-muted-foreground">
                          {lastLabel}: {fmtDateTime(c.lastOkAt)}
                        </p>
                      </div>
                      <Badge variant={CONN_TONE[c.state]} className={name === "Google Calendar" ? CAL_TONE_CLASS[c.state] : undefined}>{c.detail}</Badge>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="history">
                {error ? (
                  <p className="text-sm text-destructive">No pudimos cargar el historial.</p>
                ) : isLoading ? (
                  <p className="text-sm text-muted-foreground">Cargando historial…</p>
                ) : timeline.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Todavía no hay eventos registrados.</p>
                ) : (
                  <ol className="space-y-2">
                    {timeline.map((e, i) => (
                      <li key={i} className="rounded-xl border border-border px-3 py-2 text-sm">
                        <span className="block text-xs text-muted-foreground">
                          {fmtDateTime(e.at)}
                          {e.actor && ` · ${e.actor}`}
                        </span>
                        {e.description}
                      </li>
                    ))}
                  </ol>
                )}
                <p className="mt-3 text-xs text-muted-foreground">
                  El historial se registra desde esta versión y no se puede editar.
                </p>
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PaymentForm({
  account,
  payments,
}: {
  account: Account;
  payments: { id: string; period: string; amount: number; paid_at: string; reference: string }[];
}) {
  const qc = useQueryClient();
  const fetchBilling = useServerFn(getBilling);
  const curPeriod = previousPeriod(todayAR().period);
  const { data: billing } = useQuery({
    queryKey: ["billing", curPeriod],
    queryFn: () => fetchBilling({ data: { period: curPeriod } }),
  });
  const billingRow = billing?.rows.find((r) => r.user_id === account.user_id);
  const save = useServerFn(addPayment);
  const [period, setPeriod] = useState(previousPeriod(monthKeyAR(new Date())));
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const m = useMutation({
    mutationFn: () =>
      save({ data: { user_id: account.user_id, period, amount: Number(amount), paid_at: paidAt, reference } }),
    onSuccess: () => {
      toast.success("Pago registrado");
      setAmount("");
      setReference("");
      qc.invalidateQueries({ queryKey: ["admin-accounts"] });
      qc.invalidateQueries({ queryKey: ["admin-account-detail"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="space-y-2 rounded-xl border border-border p-3">
      <p className="text-sm font-semibold">Pagos</p>
      {billingRow && (
        <PaymentReminderStatus userId={account.user_id} sentAt={billingRow.period_reminder_at} paused={billingRow.reminders_paused} />
      )}
      <div className="grid gap-2 sm:grid-cols-4">
        <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Período abonado" />
        <Input
          type="number"
          min="0"
          placeholder="Importe"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-label="Importe"
        />
        <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} aria-label="Fecha de pago" />
        <Input
          placeholder="Referencia"
          value={reference}
          maxLength={200}
          onChange={(e) => setReference(e.target.value)}
          aria-label="Referencia"
        />
      </div>
      <div className="flex justify-end">
        <Button
          size="sm"
          disabled={!amount || Number(amount) <= 0 || !period || m.isPending}
          onClick={() => m.mutate()}
        >
          {m.isPending ? "Guardando…" : "Registrar pago"}
        </Button>
      </div>
      {payments.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin pagos registrados.</p>
      ) : (
        <ul className="divide-y divide-border text-sm">
          {payments.map((p) => (
            <li key={p.id} className="flex flex-wrap justify-between gap-2 py-1.5">
              <span>
                Período {p.period} · {fmtDate(p.paid_at)}
                {p.reference && ` · ${p.reference}`}
              </span>
              <span className="font-semibold tabular-nums">${p.amount.toLocaleString("es-AR")}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function WhatsappHistory({ months }: { months: { value: string; label: string }[] }) {
  const fetchHistory = useServerFn(listWhatsappSpendHistory);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-wa-history"],
    queryFn: () => fetchHistory(),
  });
  const [open, setOpen] = useState<string | null>(null);
  const label = (m: string) => {
    const found = months.find((x) => x.value === m);
    if (found) return found.label;
    const [y, mm] = m.split("-").map(Number);
    const l = new Date(y, mm - 1, 15).toLocaleDateString("es-AR", { month: "long", year: "numeric" });
    return l.charAt(0).toUpperCase() + l.slice(1);
  };
  if (error) return <p className="text-sm text-destructive">No pudimos cargar el historial.</p>;
  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando historial…</p>;
  if (!data?.length) return <p className="text-sm text-muted-foreground">Todavía no hay envíos registrados.</p>;
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Gasto estimado por mes con la cotización del dólar oficial de hoy + IVA {AR_VAT * 100}%.
      </p>
      <ul className="space-y-3">
        {data.map((m) => (
          <li key={m.month} className="rounded-2xl border border-border bg-card">
            <button
              type="button"
              onClick={() => setOpen(open === m.month ? null : m.month)}
              className="flex w-full flex-wrap items-center justify-between gap-2 p-4 text-left"
              aria-expanded={open === m.month}
            >
              <span>
                <span className="block font-semibold">
                  {label(m.month)}
                  {m.month === months[0].value && (
                    <Badge variant="outline" className="ml-2">En curso</Badge>
                  )}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {m.sent} mensajes enviados · {m.attempts} intentos · US${" "}
                  {(m.sent * WA_USD_PER_MESSAGE).toLocaleString("es-AR", { maximumFractionDigits: 2 })}
                </span>
              </span>
              <span className="font-heading text-xl font-bold tabular-nums">
                <CostCell messages={m.sent} />
              </span>
            </button>
            {open === m.month && (
              <ul className="border-t border-border px-4 py-2 text-sm">
                {m.byPro.map((p) => (
                  <li key={p.user_id} className="flex justify-between gap-2 py-1.5 tabular-nums">
                    <span className="truncate">{p.name} · {p.sent} mensajes</span>
                    <CostCell messages={p.sent} />
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function DeleteAccountButton({ account, onDone }: { account: Account; onDone: () => void }) {
  const qc = useQueryClient();
  const remove = useServerFn(deleteAccount);
  const m = useMutation({
    mutationFn: () => remove({ data: { user_id: account.user_id } }),
    onSuccess: () => {
      toast.success("Cuenta eliminada");
      qc.invalidateQueries({ queryKey: ["admin-accounts"] });
      qc.invalidateQueries({ queryKey: ["billing"] });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="rounded-xl border border-destructive/40 p-3">
      <p className="text-sm font-semibold text-destructive">Eliminar cuenta</p>
      <p className="mb-2 text-xs text-muted-foreground">
        Borra definitivamente la cuenta, sus pacientes, turnos y configuración. No se puede deshacer.
      </p>
      <Button
        variant="destructive"
        disabled={m.isPending}
        onClick={() => {
          if (window.confirm(`¿Eliminar definitivamente la cuenta de ${account.display_name || account.email}? Esta acción no se puede deshacer.`)) m.mutate();
        }}
      >
        {m.isPending ? "Eliminando…" : "Eliminar cuenta"}
      </Button>
    </div>
  );
}
