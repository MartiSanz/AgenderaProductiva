import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMyMessages } from "@/lib/api/messages.functions";
import { debtBannerKind, formatAmount, isPackBillable, todayAR } from "@/lib/billing";

/** Aviso al profesional cuando tiene abono o packs impagos, desde el día 5 del mes. */
export function PaymentDebtBanner() {
  const fn = useServerFn(getMyMessages);
  const { data } = useQuery({ queryKey: ["my-messages"], queryFn: () => fn(), retry: false });
  const { period, day } = todayAR();
  const key = `debt-banner-dismissed-${period}`;
  const [dismissed, setDismissed] = useState(() => typeof window !== "undefined" && sessionStorage.getItem(key) === "1");
  if (!data || dismissed) return null;
  const packDebt = data.packs.filter((p) => isPackBillable(p, { period })).reduce((s, p) => s + Number(p.price_ars), 0);
  const debt = packDebt + data.planDue.reduce((s, p) => s + Number(p.amount), 0);
  const kind = debtBannerKind(day, debt > 0, data.planDue.some((p) => p.status === "overdue"));
  if (!kind) return null;
  const overdue = kind === "overdue";
  const Icon = overdue ? AlertTriangle : Info;
  return (
    <div className={`mx-auto mb-4 flex max-w-7xl items-start gap-3 rounded-xl border p-4 ${overdue ? "border-destructive/40 bg-destructive/10" : "border-primary/40 bg-primary/10"}`} role="status">
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${overdue ? "text-destructive" : "text-primary"}`} />
      <div className="flex-1">
        <p className={`text-sm font-semibold ${overdue ? "text-destructive" : "text-heading"}`}>
          {overdue ? "Tenés un abono vencido" : "Recordatorio de pago"} · ${formatAmount(debt)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {overdue
            ? "Por favor, regularizá tu cuenta enviando el comprobante."
            : "Tu abono mensual vence el día 10. Transferí y enviá tu comprobante para mantenerte al día."}
        </p>
        <Button asChild size="sm" className="mt-3">
          <Link to="/resumen" search={{ tab: "pagos" as const }}>Ver mis pagos</Link>
        </Button>
      </div>
      <button aria-label="Cerrar aviso" onClick={() => { sessionStorage.setItem(key, "1"); setDismissed(true); }} className="text-muted-foreground hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
