import { AccessRequestsPanel, type RequestStatus } from "@/components/admin/AccessRequestsPanel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";

const REQUEST_LABELS: Record<RequestStatus, string> = {
  pending: "Pendientes",
  approved: "Activos",
  rejected: "Rechazados",
};
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { updateAccount, setFeatureOverride } from "@/lib/api/admin.functions";
import { AccountsDashboard, type Account, type AccountMetric } from "@/components/admin/AccountsDashboard";
import { BillingPanel, OverdueSummaryDialog } from "@/components/admin/BillingPanel";
import { FinancePanel, type FinanceTab } from "@/components/admin/finance/FinancePanel";

const ACCOUNT_LABELS: Record<AccountMetric, string> = {
  all: "Todas las cuentas",
  active: "Cuentas activas",
  new: "Nuevas altas",
  setup: "Pendientes de configuración",
  inactive: "Sin actividad reciente",
};

const FINANCE_LABELS: Record<FinanceTab, string> = {
  resumen: "Resumen",
  ingresos: "Ingresos",
  gastos: "Gastos e inversiones",
  rentabilidad: "Rentabilidad",
  proyecciones: "Proyecciones",
};
import { getMyEntitlements } from "@/lib/api/entitlements.functions";
import { ADMIN_VISIBLE_FEATURES, FEATURE_LABELS, PLAN_LABELS, type FeatureId } from "@/lib/entitlements";
import { isFigmaPreview } from "@/lib/figmaPreview";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    if (isFigmaPreview) return;
    const me = await getMyEntitlements();
    if (!me.isAdmin) throw redirect({ to: "/agenda" });
  },
  head: () => ({
    meta: [
      { title: "Administración de cuentas | Agendera — La agenda que se maneja sola" },
      {
        name: "description",
        content: "Panel de administración: gestioná planes, funciones habilitadas y estado de pago de cada cuenta.",
      },
      { property: "og:title", content: "Administración de cuentas | Agendera — La agenda que se maneja sola" },
      {
        property: "og:description",
        content: "Panel de administración: gestioná planes, funciones habilitadas y estado de pago de cada cuenta.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

const PAYMENT_LABELS: Record<string, string> = {
  paid: "Pagado",
  pending: "Pendiente",
  overdue: "Vencido",
};

function fmtDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}

function AdminPage() {
  const save = useServerFn(updateAccount);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Account | null>(null);
  const [toToggle, setToToggle] = useState<Account | null>(null);
  const [reason, setReason] = useState("");
  const [requestStatus, setRequestStatus] = useState<RequestStatus>("pending");
  const [accountMetric, setAccountMetric] = useState<AccountMetric>("all");
  const [financeTab, setFinanceTab] = useState<FinanceTab>("resumen");
  const [section, setSection] = useState<"cuentas" | "profesionales" | "cobranzas" | "finanzas">("profesionales");

  const toggleMutation = useMutation({
    mutationFn: (a: Account) =>
      save({
        data: {
          user_id: a.user_id,
          status: a.status === "suspended" ? "active" : "suspended",
          reason: reason.trim() || undefined,
        },
      }),
    onSuccess: (_d, a) => {
      toast.success(a.status === "suspended" ? "Cuenta reactivada" : "Cuenta suspendida");
      qc.invalidateQueries({ queryKey: ["admin-accounts"] });
      setToToggle(null);
      setReason("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="zip-ui warm-ui space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Administración</h1>
        <p className="text-sm text-muted-foreground">
          Seguí la actividad, los recordatorios, las conexiones y el historial de cada profesional.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={section === "profesionales" ? "default" : "ghost"}
              className="rounded-xl gap-1"
            >
              Solicitudes de acceso
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {(["pending", "approved", "rejected"] as const).map((s) => (
              <DropdownMenuItem
                key={s}
                onSelect={() => {
                  setRequestStatus(s);
                  setSection("profesionales");
                }}
              >
                {REQUEST_LABELS[s]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={section === "cuentas" ? "default" : "ghost"}
              className="rounded-xl gap-1"
            >
              Cuentas y planes
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {(Object.keys(ACCOUNT_LABELS) as AccountMetric[]).map((m) => (
              <DropdownMenuItem
                key={m}
                onSelect={() => {
                  setAccountMetric(m);
                  setSection("cuentas");
                }}
              >
                {ACCOUNT_LABELS[m]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant={section === "cobranzas" ? "default" : "ghost"}
          className="rounded-xl"
          onClick={() => setSection("cobranzas")}
        >
          Cobranzas
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={section === "finanzas" ? "default" : "ghost"}
              className="rounded-xl gap-1"
            >
              Finanzas
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {(Object.keys(FINANCE_LABELS) as FinanceTab[]).map((t) => (
              <DropdownMenuItem
                key={t}
                onSelect={() => {
                  setFinanceTab(t);
                  setSection("finanzas");
                }}
              >
                {FINANCE_LABELS[t]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <OverdueSummaryDialog onGoToBilling={() => setSection("cobranzas")} />

      {section === "profesionales" ? (
        <AccessRequestsPanel status={requestStatus} />
      ) : section === "cobranzas" ? (
        <BillingPanel />
      ) : section === "finanzas" ? (
        <FinancePanel tab={financeTab} />
      ) : (
        <>
          <AccountsDashboard metric={accountMetric} onEdit={setEditing} onToggleStatus={setToToggle} />

          <EditDialog account={editing} onClose={() => setEditing(null)} />

          <AlertDialog open={!!toToggle} onOpenChange={(o) => !o && setToToggle(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {toToggle?.status === "suspended" ? "¿Reactivar esta cuenta?" : "¿Suspender esta cuenta?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {toToggle?.status === "suspended"
                    ? `${toToggle?.display_name || toToggle?.email} va a poder volver a usar su agenda.`
                    : `${toToggle?.display_name || toToggle?.email} no va a poder usar su agenda hasta que la reactives. Sus datos no se borran.`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Textarea
                rows={2}
                placeholder="Motivo (opcional, queda en el historial)"
                value={reason}
                maxLength={500}
                onChange={(e) => setReason(e.target.value)}
              />
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  disabled={toggleMutation.isPending}
                  onClick={(e) => {
                    e.preventDefault();
                    if (toToggle) toggleMutation.mutate(toToggle);
                  }}
                >
                  {toToggle?.status === "suspended" ? "Reactivar" : "Suspender"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}

function overrideValue(account: Account, feature: FeatureId): "default" | "on" | "off" {
  const found = account.overrides.find((o) => o.feature === feature);
  if (!found) return "default";
  return found.enabled ? "on" : "off";
}

function EditDialog({ account, onClose }: { account: Account | null; onClose: () => void }) {
  const qc = useQueryClient();
  const save = useServerFn(updateAccount);
  const setOverride = useServerFn(setFeatureOverride);

  const [form, setForm] = useState<{
    plan: "basic" | "pro";
    status: "active" | "suspended";
    payment_status: "paid" | "pending" | "overdue";
    expires_at: string;
    last_payment_at: string;
    notes: string;
  } | null>(null);

  const current =
    form ??
    (account
      ? {
          plan: account.plan,
          status: account.status,
          payment_status: account.payment_status,
          expires_at: account.expires_at ?? "",
          last_payment_at: account.last_payment_at ?? "",
          notes: account.notes ?? "",
        }
      : null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-accounts"] });

  const mutation = useMutation({
    mutationFn: () => save({ data: { user_id: account!.user_id, ...current! } }),
    onSuccess: () => {
      toast.success("Cuenta actualizada");
      invalidate();
      setForm(null);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const overrideMutation = useMutation({
    mutationFn: (vars: { feature: FeatureId; value: "default" | "on" | "off" }) =>
      setOverride({ data: { user_id: account!.user_id, ...vars } }),
    onSuccess: () => {
      toast.success("Función actualizada");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog
      open={!!account}
      onOpenChange={(open) => {
        if (!open) {
          setForm(null);
          onClose();
        }
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        {account && current && (
          <>
            <DialogHeader>
              <DialogTitle>{account.display_name || account.email}</DialogTitle>
              <DialogDescription>{account.email}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Labeled label="Plan">
                  <Select
                    value={current.plan}
                    onValueChange={(v) => setForm({ ...current, plan: v as "basic" | "pro" })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basic">Base</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                    </SelectContent>
                  </Select>
                </Labeled>

                <Labeled label="Estado de la cuenta">
                  <Select
                    value={current.status}
                    onValueChange={(v) => setForm({ ...current, status: v as "active" | "suspended" })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Activa</SelectItem>
                      <SelectItem value="suspended">Suspendida</SelectItem>
                    </SelectContent>
                  </Select>
                </Labeled>

                <Labeled label="Estado de pago">
                  <Select
                    value={current.payment_status}
                    onValueChange={(v) => setForm({ ...current, payment_status: v as "paid" | "pending" | "overdue" })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="paid">Pagado</SelectItem>
                      <SelectItem value="pending">Pendiente</SelectItem>
                      <SelectItem value="overdue">Vencido</SelectItem>
                    </SelectContent>
                  </Select>
                </Labeled>

                <Labeled label="Último pago">
                  <Input
                    type="date"
                    value={current.last_payment_at}
                    onChange={(e) => setForm({ ...current, last_payment_at: e.target.value })}
                  />
                </Labeled>

                <Labeled label="Vencimiento del plan">
                  <Input
                    type="date"
                    value={current.expires_at}
                    onChange={(e) => setForm({ ...current, expires_at: e.target.value })}
                  />
                </Labeled>
              </div>

              <p className="text-xs text-muted-foreground">
                El vencimiento es informativo: la cuenta se marca como vencida pero el plan no cambia solo.
              </p>

              <Labeled label="Notas internas">
                <Textarea
                  rows={3}
                  value={current.notes}
                  onChange={(e) => setForm({ ...current, notes: e.target.value })}
                />
              </Labeled>

              <div className="space-y-2 rounded-md border border-border p-3">
                <p className="text-sm font-medium">Funciones (excepciones)</p>
                {ADMIN_VISIBLE_FEATURES.map((feature) => (
                  <div key={feature} className="flex items-center justify-between gap-3">
                    <span className="text-sm">{FEATURE_LABELS[feature]}</span>
                    <Select
                      value={overrideValue(account, feature)}
                      onValueChange={(v) => overrideMutation.mutate({ feature, value: v as "default" | "on" | "off" })}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Según el plan</SelectItem>
                        <SelectItem value="on">Forzar activada</SelectItem>
                        <SelectItem value="off">Forzar desactivada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={onClose}>
                  Cancelar
                </Button>
                <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
                  {mutation.isPending ? "Guardando…" : "Guardar cambios"}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
