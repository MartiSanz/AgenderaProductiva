import { matchesSearch } from "@/lib/search";
import { useEffect, useMemo, useState } from "react";
import { compareByName } from "@/lib/sort";
import { PhoneInput } from "@/components/PhoneInput";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, Bell, CheckCircle2, Clock, Phone, PhoneOff, Settings2, SlidersHorizontal, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getBilling, getPackPrices, sendManualPaymentReminder, setProfessionalPhone, updateBillingSettings, updatePackPrices } from "@/lib/api/billing.functions";
import { addPayment, updateAccount } from "@/lib/api/admin.functions";
import { deadlineLabel, formatAmount, previousPeriod, todayAR, type BillingStatus } from "@/lib/billing";
import { PaymentReminderStatus } from "@/components/admin/PaymentReminderStatus";

type Row = Awaited<ReturnType<typeof getBilling>>["rows"][number];

const STATUS: Record<BillingStatus, { label: string; cls: string }> = {
  paid: { label: "Pagó", cls: "bg-accent text-accent-foreground" },
  pending: { label: "Pendiente", cls: "bg-muted text-muted-foreground" },
  due_soon: { label: "Vence pronto", cls: "bg-secondary text-secondary-foreground" },
  overdue: { label: "Vencida", cls: "bg-destructive/15 text-destructive" },
};

function monthOptions() {
  const { period } = todayAR();
  const [y, m] = period.split("-").map(Number);
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("es-AR", { month: "long", year: "numeric", timeZone: "UTC" });
    return [key, label.charAt(0).toUpperCase() + label.slice(1)] as const;
  });
}

const fmtDate = (v: string | null) =>
  v ? new Date(v.length === 10 ? `${v}T12:00:00` : v).toLocaleDateString("es-AR", { day: "2-digit", month: "short" }) : "—";

export function billingQuery(period: string, fn: (a: { data: { period: string } }) => ReturnType<typeof getBilling>) {
  return { queryKey: ["billing", period], queryFn: () => fn({ data: { period } }) };
}

export function BillingPanel() {
  const fetchBilling = useServerFn(getBilling);
  const [period, setPeriod] = useState(previousPeriod(todayAR().period));
  const [filter, setFilter] = useState<"all" | BillingStatus>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [paying, setPaying] = useState<Row | null>(null);
  const [phoneRow, setPhoneRow] = useState<Row | null>(null);
  const [usageRow, setUsageRow] = useState<Row | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { data, isLoading } = useQuery(billingQuery(period, fetchBilling));
  const remind = useServerFn(sendManualPaymentReminder);
  const qc = useQueryClient();

  const remindM = useMutation({
    mutationFn: (r: Row) => remind({ data: { user_id: r.user_id, period } }),
    onSuccess: (res, r) => {
      if (res.ok) toast.success(`Recordatorio enviado a ${r.name}`);
      else toast.error(res.error);
      qc.invalidateQueries({ queryKey: ["billing"] });
    },
  });

  const rows = data?.rows ?? [];
  const counts = useMemo(() => {
    const c = { paid: 0, pending: 0, due_soon: 0, overdue: 0 } as Record<BillingStatus, number>;
    rows.forEach((r) => c[r.status]++);
    return c;
  }, [rows]);
  const collected = rows.reduce((s, r) => s + r.paid_amount, 0);
  const expected = rows.reduce((s, r) => s + r.amount_due, 0);
  const shown = (filter === "all" ? rows : rows.filter((r) => r.status === filter))
    .filter((r) => matchesSearch(search, r.name, r.email, r.phone))
    .sort(
    (a, b) => compareByName(a.name, b.name),
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Cobranzas</h2>
          <p className="text-sm text-muted-foreground">Fecha límite: {deadlineLabel(period)}. Aviso automático el día 9 a quienes no pagaron.</p>
        </div>
        <div className="flex gap-2">
          <select
            aria-label="Período"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="h-10 rounded-xl border border-border bg-card px-3 text-sm"
          >
            {monthOptions().map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </select>
          <Button variant="outline" className="rounded-xl" onClick={() => setSettingsOpen(true)}>
            <Settings2 className="h-4 w-4" /> Datos de cobro
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={<Wallet className="h-4 w-4" />} label="Cobrado" value={`$${formatAmount(collected)}`} hint={`de $${formatAmount(expected)}`} />
        <Kpi icon={<CheckCircle2 className="h-4 w-4" />} label="Pagaron" value={counts.paid} hint={`de ${rows.length} cuentas`} />
        <Kpi icon={<Clock className="h-4 w-4" />} label="Sin pagar" value={counts.pending + counts.due_soon} hint={counts.due_soon ? `${counts.due_soon} vencen pronto` : "a tiempo"} />
        <Kpi icon={<AlertTriangle className="h-4 w-4" />} label="Vencidas" value={counts.overdue} hint="revisar desactivación" danger={counts.overdue > 0} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar por nombre, email o teléfono…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm rounded-xl sm:max-w-xs"
        />
        <Button type="button" variant="outline" className="rounded-xl" onClick={() => setFiltersOpen(true)}>
          <SlidersHorizontal className="h-4 w-4" />
          Filtros
          {filter !== "all" && (
            <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-xs font-semibold text-primary-foreground">1</span>
          )}
        </Button>
      </div>

      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Filtros</DialogTitle>
            <DialogDescription>Elegí el estado del pago para filtrar la lista.</DialogDescription>
          </DialogHeader>
          <label className="grid gap-1 text-sm font-medium">
            Estado del pago
            <Select value={filter} onValueChange={(v) => setFilter(v as "all" | BillingStatus)}>
              <SelectTrigger className="w-full" aria-label="Estado del pago">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{`Todas (${rows.length})`}</SelectItem>
                {(["overdue", "due_soon", "pending", "paid"] as const).map((k) => (
                  <SelectItem key={k} value={k}>{`${STATUS[k].label} (${counts[k]})`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <div className="flex items-center justify-between gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setFilter("all")} disabled={filter === "all"}>
              Limpiar filtros
            </Button>
            <Button type="button" onClick={() => setFiltersOpen(false)}>
              Ver {shown.length} {shown.length === 1 ? "cuenta" : "cuentas"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No hay cuentas en este estado.</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {shown.map((r) => (
            <li key={r.user_id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-semibold">{r.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span>
                  {r.account_status === "suspended" && <span className="rounded-full bg-muted px-2 py-0.5 text-xs">Suspendida</span>}
                  {!r.phone && <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive"><PhoneOff className="h-3 w-3" />Sin teléfono</span>}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {r.phone ? ` · ${r.phone}` : ""}
                  {r.status === "paid" ? ` · pagó el ${fmtDate(r.paid_at)}` : ""}
                  {r.last_reminder_at ? ` · último aviso ${fmtDate(r.last_reminder_at)}` : ""}
                </p>
                <div className="mt-1.5">
                  <PaymentReminderStatus userId={r.user_id} sentAt={r.period_reminder_at} paused={r.reminders_paused} />
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="text-right">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total a cobrar</p>
                  <p className="text-3xl font-extrabold leading-tight text-primary">${formatAmount(r.amount_due)}</p>
                </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button size="sm" variant="ghost" className="rounded-xl" onClick={() => setPhoneRow(r)}>
                  <Phone className="h-4 w-4" /> {r.phone ? "Editar teléfono" : "Agregar teléfono"}
                </Button>
                <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setUsageRow(r)}>
                  <Wallet className="h-4 w-4" /> Consumos del mes
                </Button>
                {r.status !== "paid" && (
                  <Button size="sm" variant="outline" className="rounded-xl" disabled={remindM.isPending || !r.phone} title={r.phone ? undefined : "Sin teléfono cargado"} onClick={() => remindM.mutate(r)}>
                    <Bell className="h-4 w-4" /> Recordar pago
                  </Button>
                )}
                <Button size="sm" className="rounded-xl" variant={r.status === "paid" ? "ghost" : "default"} onClick={() => setPaying(r)}>
                  {r.status === "paid" ? "Otro pago" : "Registrar pago"}
                </Button>
              </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <PaymentDialog row={paying} period={period} onClose={() => setPaying(null)} />
      <PhoneDialog row={phoneRow} onClose={() => setPhoneRow(null)} />
      <Dialog open={!!usageRow} onOpenChange={(o) => !o && setUsageRow(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Consumos del mes</DialogTitle>
            <DialogDescription>{usageRow?.name} · período {deadlineLabel(period).slice(3)}</DialogDescription>
          </DialogHeader>
          {usageRow && (
            <div className="space-y-1 rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm">
              <div className="flex justify-between gap-3"><span>Abono {usageRow.plan === "pro" ? "Pro" : "Base"}</span><span>${formatAmount(usageRow.plan_amount)}</span></div>
              {usageRow.packs.length === 0 ? (
                <div className="flex justify-between gap-3 text-muted-foreground"><span>Packs comprados</span><span>0</span></div>
              ) : (
                usageRow.packs.map((k, i) => (
                  <div key={i} className="flex justify-between gap-3"><span>Pack {k.quantity} mensajes · {fmtDate(k.purchased_at)}</span><span>${formatAmount(k.price)}</span></div>
                ))
              )}
              <div className="mt-1 flex justify-between gap-3 border-t border-border pt-1 font-semibold">
                <span>Total a cobrar</span><span>${formatAmount(usageRow.amount_due)}</span>
              </div>
              {usageRow.paid_amount > 0 && (
                <div className={`flex justify-between gap-3 text-xs ${usageRow.paid_amount === usageRow.amount_due ? "text-muted-foreground" : "text-destructive"}`}>
                  <span>Pagado</span><span>${formatAmount(usageRow.paid_amount)}{usageRow.paid_amount !== usageRow.amount_due ? ` · diferencia $${formatAmount(usageRow.amount_due - usageRow.paid_amount)}` : ""}</span>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      {data && <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} initial={data.settings} />}
    </div>
  );
}

function Kpi({ icon, label, value, hint, danger }: { icon: React.ReactNode; label: string; value: React.ReactNode; hint: string; danger?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${danger ? "border-destructive/40 bg-destructive/5" : "border-border bg-card"}`}>
      <div className={`flex items-center gap-2 text-xs font-semibold ${danger ? "text-destructive" : "text-muted-foreground"}`}>{icon}{label}</div>
      <div className="mt-1 font-heading text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}

function PaymentDialog({ row, period, onClose }: { row: Row | null; period: string; onClose: () => void }) {
  const pay = useServerFn(addPayment);
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(todayAR().date);
  const [ref, setRef] = useState("");
  useEffect(() => {
    if (row) { setAmount(String(row.amount_due)); setPaidAt(todayAR().date); setRef(""); }
  }, [row]);
  const m = useMutation({
    mutationFn: () => pay({ data: { user_id: row!.user_id, period, amount: Number(amount), paid_at: paidAt, reference: ref } }),
    onSuccess: () => {
      toast.success("Pago registrado");
      qc.invalidateQueries({ queryKey: ["billing"] });
      qc.invalidateQueries({ queryKey: ["admin-accounts"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
          <DialogDescription>{row?.name} · período {deadlineLabel(period).slice(3)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label htmlFor="pay-amount">Monto</Label><Input id="pay-amount" type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div><Label htmlFor="pay-date">Fecha de pago</Label><Input id="pay-date" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} /></div>
          <div><Label htmlFor="pay-ref">Referencia</Label><Input id="pay-ref" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="N° de transferencia" /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button disabled={!(Number(amount) > 0) || !paidAt || m.isPending} onClick={() => m.mutate()}>Guardar pago</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SettingsDialog({ open, onClose, initial }: { open: boolean; onClose: () => void; initial: { amount_basic: number; amount_pro: number; alias: string; receipt_phone: string } }) {
  const save = useServerFn(updateBillingSettings);
  const qc = useQueryClient();
  const [s, setS] = useState(initial);
  useEffect(() => { if (open) setS(initial); }, [open, initial]);
  const fetchPacks = useServerFn(getPackPrices);
  const savePacks = useServerFn(updatePackPrices);
  const packsQ = useQuery({ queryKey: ["pack-prices"], queryFn: () => fetchPacks(), enabled: open });
  const [prices, setPrices] = useState<Record<string, string>>({});
  useEffect(() => {
    if (open && packsQ.data) setPrices(Object.fromEntries(packsQ.data.map((p) => [p.id, String(p.price_ars)])));
  }, [open, packsQ.data]);
  const m = useMutation({
    mutationFn: async () => {
      await save({ data: { ...s, amount_basic: Number(s.amount_basic), amount_pro: Number(s.amount_pro) } });
      const packs = Object.entries(prices).map(([id, v]) => ({ id, price_ars: Number(v) }));
      if (packs.some((p) => !(p.price_ars >= 0) || Number.isNaN(p.price_ars))) throw new Error("Revisá los precios de los packs.");
      if (packs.length) await savePacks({ data: { packs } });
    },
    onSuccess: () => { toast.success("Datos de cobro guardados"); qc.invalidateQueries({ queryKey: ["billing"] }); qc.invalidateQueries({ queryKey: ["pack-prices"] }); qc.invalidateQueries(); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Datos de cobro</DialogTitle>
          <DialogDescription>Se usan en el recordatorio de pago por WhatsApp.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div><Label htmlFor="b-basic">Cuota Base</Label><Input id="b-basic" type="number" value={s.amount_basic} onChange={(e) => setS({ ...s, amount_basic: e.target.value as any })} /></div>
          <div><Label htmlFor="b-pro">Cuota Pro</Label><Input id="b-pro" type="number" value={s.amount_pro} onChange={(e) => setS({ ...s, amount_pro: e.target.value as any })} /></div>
          <div className="col-span-2"><Label htmlFor="b-alias">Alias</Label><Input id="b-alias" value={s.alias} onChange={(e) => setS({ ...s, alias: e.target.value })} /></div>
          <div className="col-span-2"><Label htmlFor="b-phone">WhatsApp para comprobantes</Label><PhoneInput id="b-phone" value={s.receipt_phone} onChange={(v) => setS({ ...s, receipt_phone: v })} /></div>
          <div className="col-span-2 pt-2">
            <p className="text-sm font-semibold">Precios de packs de mensajes</p>
            <p className="text-xs text-muted-foreground">Aplican a las compras nuevas; las ya hechas conservan su precio.</p>
          </div>
          {(packsQ.data ?? []).map((p) => (
            <div key={p.id}>
              <Label htmlFor={`pack-${p.id}`}>Pack de {p.quantity}</Label>
              <Input id={`pack-${p.id}`} type="number" min={0} value={prices[p.id] ?? ""} onChange={(e) => setPrices({ ...prices, [p.id]: e.target.value })} />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button disabled={m.isPending} onClick={() => m.mutate()}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Popup al entrar a Administración después del día 10 si hay cuentas vencidas. Nunca suspende solo. */
export function OverdueSummaryDialog({ onGoToBilling }: { onGoToBilling: () => void }) {
  const fetchBilling = useServerFn(getBilling);
  const save = useServerFn(updateAccount);
  const qc = useQueryClient();
  const { period, day } = todayAR();
  const { data } = useQuery({ ...billingQuery(period, fetchBilling), enabled: day > 10 });
  const overdue = (data?.rows ?? []).filter((r) => r.status === "overdue" && r.account_status === "active");
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const key = `overdue-seen-${period}`;
    if (overdue.length && !sessionStorage.getItem(key)) { setOpen(true); sessionStorage.setItem(key, "1"); }
  }, [overdue.length, period]);
  const suspend = useMutation({
    mutationFn: (r: Row) => save({ data: { user_id: r.user_id, status: "suspended", reason: `Cuota ${period} impaga` } }),
    onSuccess: (_d, r) => { toast.success(`${r.name} suspendida`); qc.invalidateQueries({ queryKey: ["billing"] }); qc.invalidateQueries({ queryKey: ["admin-accounts"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cuentas con cuota vencida</DialogTitle>
          <DialogDescription>
            {overdue.length} {overdue.length === 1 ? "profesional no registró" : "profesionales no registraron"} el pago antes del {deadlineLabel(period)}. Ninguna cuenta se suspende sola: decidí vos.
          </DialogDescription>
        </DialogHeader>
        <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-xl border border-border">
          {overdue.map((r) => (
            <li key={r.user_id} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{r.name}</p>
                <p className="text-xs text-muted-foreground">${formatAmount(r.amount_due)} · último aviso {fmtDate(r.last_reminder_at)}</p>
              </div>
              <Button size="sm" variant="outline" className="rounded-xl text-destructive" disabled={suspend.isPending} onClick={() => suspend.mutate(r)}>Suspender</Button>
            </li>
          ))}
          {overdue.length === 0 && <li className="p-3 text-sm text-muted-foreground">Todas resueltas.</li>}
        </ul>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Más tarde</Button>
          <Button onClick={() => { setOpen(false); onGoToBilling(); }}>Ir a Cobranzas</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PhoneDialog({ row, onClose }: { row: Row | null; onClose: () => void }) {
  const save = useServerFn(setProfessionalPhone);
  const qc = useQueryClient();
  const [phone, setPhone] = useState("");
  useEffect(() => { if (row) setPhone(row.phone ?? ""); }, [row]);
  const m = useMutation({
    mutationFn: () => save({ data: { user_id: row!.user_id, phone } }),
    onSuccess: () => {
      toast.success("Teléfono guardado");
      qc.invalidateQueries({ queryKey: ["billing"] });
      qc.invalidateQueries({ queryKey: ["admin-accounts"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{row?.phone ? "Editar teléfono" : "Agregar teléfono"}</DialogTitle>
          <DialogDescription>{row?.name} · se usa para los recordatorios de pago por WhatsApp.</DialogDescription>
        </DialogHeader>
        <div><Label htmlFor="pro-phone">WhatsApp del profesional</Label><PhoneInput id="pro-phone" value={phone} onChange={setPhone} /></div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button disabled={phone.replace(/\D/g, "").length < 6 || m.isPending} onClick={() => m.mutate()}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
