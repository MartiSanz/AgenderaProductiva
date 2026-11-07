import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { MessageSquare, Package, AlertTriangle, CheckCircle2, Copy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { buyMessagePack, getMyMessages } from "@/lib/api/messages.functions";
import { activePacks, availableMessages, daysUntil, MONTHLY_REMINDERS } from "@/lib/messageCredits";
import { deadlineLabel, formatAmount, isPackBillable, todayAR } from "@/lib/billing";

const fmtDate = (iso: string) => new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));

function useMessages() {
  const fn = useServerFn(getMyMessages);
  return useQuery({ queryKey: ["my-messages"], queryFn: () => fn() });
}

export function MessagesTab() {
  const { data, isLoading } = useMessages();
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<string | null>(null);
  const qc = useQueryClient();
  const buy = useServerFn(buyMessagePack);
  const mut = useMutation({
    mutationFn: (packId: string) => buy({ data: { packId } }),
    onSuccess: () => {
      toast.success("Pack acreditado. Ya podés usar los mensajes.");
      setOpen(false);
      setChoice(null);
      qc.invalidateQueries({ queryKey: ["my-messages"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  const totals = availableMessages(data.sentThisMonth, data.packs);
  const live = activePacks(data.packs).sort((a, b) => a.expires_at.localeCompare(b.expires_at));
  const used = Math.min(data.sentThisMonth, MONTHLY_REMINDERS);
  const selected = data.catalog.find((c) => c.id === choice);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MessageSquare className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Mensajes disponibles</p>
              <p className="text-4xl font-bold text-heading">{totals.total}</p>
            </div>
          </div>
          <Button onClick={() => setOpen(true)}>Comprar mensajes adicionales</Button>
        </CardContent>
      </Card>

      {totals.total === 0 ? (
        <Alert tone="destructive" text="Te quedaste sin mensajes: los recordatorios no se enviarán hasta que compres un pack o empiece el próximo mes. Los turnos siguen guardados." />
      ) : totals.total <= 20 ? (
        <Alert text={`Te quedan ${totals.total} mensajes. Considerá sumar un pack para no quedarte sin recordatorios.`} />
      ) : null}

      <Card>
        <CardHeader><CardTitle className="text-base">Cupo mensual del plan</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary" style={{ width: `${(used / MONTHLY_REMINDERS) * 100}%` }} />
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <Stat label="Incluidos" value={MONTHLY_REMINDERS} />
            <Stat label="Enviados" value={used} />
            <Stat label="Restantes" value={totals.monthlyLeft} />
          </div>
          <p className="text-xs text-muted-foreground">Se renueva el {fmtDate(data.renewsAt)} ({daysUntil(data.renewsAt)} días). Los mensajes del mes no se acumulan.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Packs vigentes</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {live.length === 0 && <p className="text-sm text-muted-foreground">No tenés packs activos. Se usan cuando se termina el cupo mensual.</p>}
          {live.map((p) => {
            const days = daysUntil(p.expires_at);
            return (
              <div key={p.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-medium"><Package className="h-4 w-4 text-primary" /> Pack de {p.quantity}</span>
                  <span className="text-sm">{p.remaining} restantes</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${(p.remaining / p.quantity) * 100}%` }} />
                </div>
                <p className={`mt-1 text-xs ${days < 15 ? "text-destructive" : "text-muted-foreground"}`}>
                  Vence el {fmtDate(p.expires_at)} · {days} días{days < 5 ? " — ¡usalo pronto!" : days < 15 ? " — vence pronto" : ""}
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setChoice(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Comprar mensajes adicionales</DialogTitle>
            <DialogDescription>Se acreditan al instante y duran 90 días. El pago se hace por transferencia.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {data.catalog.map((c) => (
              <button key={c.id} type="button" onClick={() => setChoice(c.id)}
                className={`rounded-lg border-2 p-3 text-left transition ${choice === c.id ? "border-primary bg-primary/10" : "border-border"}`}>
                <p className="text-xl font-bold text-heading">{c.quantity}</p>
                <p className="text-xs text-muted-foreground">mensajes</p>
                <p className="mt-1 font-medium">${formatAmount(c.price_ars)}</p>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button disabled={!selected || mut.isPending} onClick={() => selected && mut.mutate(selected.id)}>
              {selected ? `Comprar por $${formatAmount(selected.price_ars)}` : "Elegí un pack"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function PaymentsTab() {
  const { data, isLoading } = useMessages();
  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  const today = todayAR();
  const pending = data.packs.filter((p) => isPackBillable(p, today));
  const packDebt = pending.reduce((s, p) => s + Number(p.price_ars), 0);
  const planDebt = data.planDue.reduce((s, p) => s + Number(p.amount), 0);
  const debt = packDebt + planDebt;
  const overdue = data.planDue.some((p) => p.status === "overdue");
  const receiptMessage = "¡Hola! 👋😊\n\nComparto el comprobante de pago de mi abono mensual.\n\n¡Muchas gracias! 🧡";
  const waLink = data.receiptPhone ? `https://wa.me/549${data.receiptPhone.replace(/\D/g, "").replace(/^(54)?9?/, "")}?text=${encodeURIComponent(receiptMessage)}` : null;

  return (
    <div className="space-y-6">
      {debt > 0 ? (
        <Card className="border-primary">
          <CardContent className="space-y-3 pt-6">
            <p className="text-sm text-muted-foreground">Saldo pendiente</p>
            <p className="text-3xl font-bold text-heading">${formatAmount(debt)}</p>
            <div className="space-y-1 text-sm">
              {data.planDue.map((p) => (
                <p key={p.period} className={p.status === "overdue" ? "text-destructive" : ""}>
                  Abono del plan {p.period}: ${formatAmount(p.amount)} · {p.status === "overdue" ? "Vencido" : `vence el ${deadlineLabel(p.period)}`}
                </p>
              ))}
              {packDebt > 0 && <p>Packs de mensajes: ${formatAmount(packDebt)}</p>}
            </div>
            {overdue && <p className="text-sm text-destructive">Tenés un abono vencido. Transferí y enviá el comprobante para regularizarlo.</p>}
            {data.alias && (
              <button type="button" className="flex items-center gap-2 text-sm" onClick={() => { navigator.clipboard.writeText(data.alias); toast.success("Alias copiado"); }}>
                Alias: <strong>{data.alias}</strong> <Copy className="h-4 w-4" />
              </button>
            )}
            {waLink && <Button asChild><a href={waLink} target="_blank" rel="noreferrer">Enviar comprobante por WhatsApp</a></Button>}
          </CardContent>
        </Card>
      ) : (
        <Card><CardContent className="flex items-center gap-3 pt-6"><CheckCircle2 className="h-5 w-5 text-primary" /> Estás al día con tus pagos.</CardContent></Card>
      )}

      {(() => {
        const curPacks = data.packs.filter((p) => p.payment_status === "pending" && !p.cancelled_at && todayAR(new Date(p.purchased_at)).period === today.period);
        const curPackSum = curPacks.reduce((s, p) => s + Number(p.price_ars), 0);
        const plan = Number(data.planAmount ?? 0);
        if (plan + curPackSum <= 0) return null;
        return (
          <Card>
            <CardHeader><CardTitle className="text-base">Consumo del mes en curso</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="text-3xl font-bold text-heading">${formatAmount(plan + curPackSum)}</p>
              {plan > 0 && <p>Abono del plan: ${formatAmount(plan)}</p>}
              <p>Packs de mensajes comprados este mes: ${formatAmount(curPackSum)}</p>
              <p className="text-muted-foreground">Lo pagás a mes vencido: vence el {deadlineLabel(today.period)}.</p>
            </CardContent>
          </Card>
        );
      })()}

      <Card>
        <CardHeader><CardTitle className="text-base">Compras de packs</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {data.packs.length === 0 && <p className="text-sm text-muted-foreground">Todavía no compraste packs.</p>}
          {data.packs.map((p) => (
            <Row key={p.id} left={`Pack de ${p.quantity} · ${fmtDate(p.purchased_at)}`} amount={p.price_ars}
              status={p.cancelled_at ? "Anulado" : p.payment_status === "paid" ? "Pagado" : isPackBillable(p, today) ? "Pendiente" : "Se cobra el mes próximo"} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Abonos del plan</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {data.planDue.map((p) => (
            <Row key={`due-${p.period}`} left={`Período ${p.period} · vence ${deadlineLabel(p.period)}`} amount={p.amount} status={p.status === "overdue" ? "Vencido" : "Pendiente"} />
          ))}
          {data.planPayments.length === 0 && data.planDue.length === 0 && <p className="text-sm text-muted-foreground">Sin pagos registrados.</p>}
          {data.planPayments.map((p) => (
            <Row key={p.id} left={`Período ${p.period} · ${fmtDate(p.paid_at)}`} amount={p.amount} status="Pagado" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ left, amount, status }: { left: string; amount: number; status: string }) {
  const tone = status === "Pagado" ? "bg-primary/10 text-primary" : status === "Pendiente" ? "bg-accent text-accent-foreground" : status === "Anulado" ? "bg-muted text-muted-foreground" : "bg-destructive/10 text-destructive";
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border p-3 text-sm">
      <span>{left}</span>
      <span className="flex items-center gap-2 whitespace-nowrap">
        ${formatAmount(Number(amount))}
        <span className={`rounded-full px-2 py-0.5 text-xs ${tone}`}>{status}</span>
      </span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted/50 p-2">
      <p className="text-lg font-bold text-heading">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function Alert({ text, tone }: { text: string; tone?: "destructive" }) {
  return (
    <div className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${tone ? "border-destructive/40 bg-destructive/10" : "border-primary/40 bg-primary/10"}`}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {text}
    </div>
  );
}
