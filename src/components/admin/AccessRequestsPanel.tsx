import { matchesSearch } from "@/lib/search";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  listAccessRequests,
  reviewAccessRequest,
  resendAccessInvite,
  deleteRejectedAccessRequest,
  type AccessRequest,
} from "@/lib/api/access.functions";

const STATUS_TABS = [
  { id: "pending", label: "Pendientes" },
  { id: "approved", label: "Activos" },
  { id: "rejected", label: "Rechazados" },
] as const;

type StatusId = (typeof STATUS_TABS)[number]["id"];
export type RequestStatus = StatusId;

function fmt(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
}

export function AccessRequestsPanel({ status = "pending" }: { status?: StatusId }) {
  const fetchRequests = useServerFn(listAccessRequests);
  const { data, isLoading } = useQuery({
    queryKey: ["access-requests"],
    queryFn: () => fetchRequests(),
  });
  const tab = status;
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<AccessRequest | null>(null);

  const rows = useMemo(() => {
    const list = (data ?? []) as AccessRequest[];
    const q = search.trim().toLowerCase();
    return list
      .filter((r) => r.status === tab)
      .filter(
        (r) =>
          matchesSearch(q, r.full_name, r.email, r.phone, r.profession),
      );
  }, [data, tab, search]);


  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold tracking-tight">
        {STATUS_TABS.find((s) => s.id === tab)?.label}
      </h2>
      <p className="text-sm text-muted-foreground">
        Solicitudes de acceso enviadas desde la landing. Una solicitud no es una cuenta: el
        profesional recibe la invitación por email recién cuando la aprobás.
      </p>

      <Input
        placeholder="Buscar por nombre, email, teléfono o actividad…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando solicitudes…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay solicitudes en este estado.</p>
      ) : (
        <div className="grid gap-3">
          {rows.map((r) => (
            <Card key={r.id} className="border-l-[6px] border-l-day-2">
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{r.full_name}</CardTitle>
                    <CardDescription>
                      {r.profession || "—"} · Plan {r.requested_plan === "pro" ? "Pro" : "Base"} · {r.email}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Solicitud {fmt(r.created_at)}</span>
                    <StatusBadge status={r.status} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex justify-end pt-0">
                <Button size="sm" variant="outline" onClick={() => setOpen(r)}>
                  Ver solicitud
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <RequestDialog request={open} onClose={() => setOpen(null)} />
    </div>
  );
}

function StatusBadge({ status }: { status: AccessRequest["status"] }) {
  if (status === "approved") return <Badge>🟢 Activo</Badge>;
  if (status === "rejected") return <Badge variant="destructive">🔴 Rechazado</Badge>;
  return <Badge variant="secondary">🟡 Pendiente</Badge>;
}

function RequestDialog({ request, onClose }: { request: AccessRequest | null; onClose: () => void }) {
  const qc = useQueryClient();
  const review = useServerFn(reviewAccessRequest);
  const resend = useServerFn(resendAccessInvite);

  const mutation = useMutation({
    mutationFn: async (action: "approve" | "reject" | "reset") =>
      review({ data: { id: request!.id, action, origin: window.location.origin } }),
    onSuccess: (res, action) => {
      qc.invalidateQueries({ queryKey: ["access-requests"] });
      if (action === "approve") {
        if (res.whatsappTo) toast.success(`Solicitud aprobada. Enviamos el WhatsApp de bienvenida a ${res.whatsappTo}.`);
        else toast.warning(`Solicitud aprobada, pero no se pudo enviar el WhatsApp: ${res.whatsappError}`);
      } else toast.success("Solicitud actualizada.");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message || "No se pudo actualizar la solicitud."),
  });

  const resendMutation = useMutation({
    mutationFn: async () => resend({ data: { id: request!.id, origin: window.location.origin } }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["access-requests"] });
      if (res.whatsappTo) toast.success(`WhatsApp de bienvenida reenviado a ${res.whatsappTo}.`);
      else toast.warning(`No se pudo enviar el WhatsApp: ${res.whatsappError}`);
    },

    onError: (e: Error) => toast.error(e.message || "No se pudo reenviar la invitación."),
  });

  const remove = useServerFn(deleteRejectedAccessRequest);
  const deleteMutation = useMutation({
    mutationFn: async () => remove({ data: { id: request!.id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["access-requests"] });
      toast.success("Solicitud eliminada. La persona puede volver a enviarla.");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message || "No se pudo eliminar la solicitud."),
  });

  const busy = mutation.isPending || resendMutation.isPending || deleteMutation.isPending;

  return (
    <Dialog open={!!request} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        {request && (
          <>
            <DialogHeader>
              <DialogTitle>{request.full_name}</DialogTitle>
              <DialogDescription>
                {request.profession || "Sin actividad indicada"} · {request.city || "Sin ciudad"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 text-sm">
              <Row label="Email" value={request.email} />
              <Row label="Teléfono" value={request.phone || "—"} />
              <Row label="Profesión / actividad" value={request.profession || "—"} />
              <Row
                label="Plan solicitado"
                value={request.requested_plan === "pro" ? "Pro" : "Base"}
              />
              {(() => {
                const [c, p, co] = (request.city || "").split(",").map((s) => s.trim());
                return (
                  <>
                    <Row label="Ciudad" value={c || "—"} />
                    <Row label="Provincia" value={p || "—"} />
                    <Row label="País" value={co || (p ? "Argentina" : "—")} />
                  </>
                );
              })()}
              <Row label="Turnos por semana" value={request.weekly_volume || "—"} />
              <Row label="Solicitud" value={fmt(request.created_at)} />
              <Row
                label="Alta / aprobación"
                value={request.status === "approved" ? fmt(request.reviewed_at) : "—"}
              />
              <Row label="Invitación enviada" value={fmt(request.invited_at)} />
              {request.goal && (
                <div className="rounded-md bg-muted/50 p-3">
                  <span className="block text-xs text-muted-foreground">Qué quiere resolver</span>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{request.goal}</p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              {request.status === "approved" ? (
                <>
                  <Button variant="outline" disabled={busy} onClick={() => resendMutation.mutate()}>
                    Reenviar invitación
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={busy}
                    onClick={() => mutation.mutate("reject")}
                  >
                    Desactivar
                  </Button>
                </>
              ) : (
                <>
                  {request.status === "rejected" && (
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(`¿Eliminar la solicitud de ${request.full_name}? Podrá volver a enviarla.`))
                          deleteMutation.mutate();
                      }}
                    >
                      Eliminar solicitud
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    disabled={busy}
                    onClick={() => mutation.mutate("reject")}
                  >
                    Rechazar
                  </Button>
                  <Button disabled={busy} onClick={() => mutation.mutate("approve")}>
                    {mutation.isPending ? "Aprobando…" : "Aprobar e invitar"}
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/60 pb-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
