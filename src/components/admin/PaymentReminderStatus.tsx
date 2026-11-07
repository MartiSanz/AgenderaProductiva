import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BellOff, BellRing, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setPaymentReminders } from "@/lib/api/billing.functions";

const fmt = (v: string) =>
  new Date(v).toLocaleString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" });

export function PaymentReminderStatus({
  userId,
  sentAt,
  paused,
}: {
  userId: string;
  sentAt: string | null;
  paused: boolean;
}) {
  const qc = useQueryClient();
  const toggle = useServerFn(setPaymentReminders);
  const m = useMutation({
    mutationFn: () => toggle({ data: { user_id: userId, enabled: paused } }),
    onSuccess: () => {
      toast.success(paused ? "Recordatorios de pago reactivados" : "Recordatorios de pago pausados");
      qc.invalidateQueries({ queryKey: ["billing"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${sentAt ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}
      >
        <Send className="h-3 w-3" />
        {sentAt ? `Recordatorio enviado · ${fmt(sentAt)}` : "Recordatorio no enviado"}
      </span>
      {paused && (
        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 font-semibold text-destructive">
          <BellOff className="h-3 w-3" /> Envío apagado
        </span>
      )}
      <Button size="sm" variant="ghost" className="h-7 rounded-xl px-2 text-xs" disabled={m.isPending} onClick={() => m.mutate()}>
        {paused ? <BellRing className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
        {paused ? "Encender envío" : "Apagar envío"}
      </Button>
    </div>
  );
}
