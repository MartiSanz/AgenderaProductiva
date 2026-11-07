import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, BellRing } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { listAccessRequests, type AccessRequest } from "@/lib/api/access.functions";
import { getVapidPublicKey, sendTestPush } from "@/lib/api/push.functions";
import { isFigmaPreview } from "@/lib/figmaPreview";

function ago(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}

function urlB64ToUint8(s: string) {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const pushSupported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

export function AdminNotificationsBell({ admin = true }: { admin?: boolean }) {
  const fetchRequests = useServerFn(listAccessRequests);
  const fetchKey = useServerFn(getVapidPublicKey);
  const testPush = useServerFn(sendTestPush);
  const { data } = useQuery({
    queryKey: ["access-requests"],
    queryFn: () => fetchRequests(),
    refetchInterval: 60_000,
    enabled: admin,
  });
  const pending = ((data ?? []) as AccessRequest[]).filter((r) => r.status === "pending");
  const [pushOn, setPushOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isFigmaPreview) {
      setPushOn(false);
      return;
    }
    if (!pushSupported()) return setPushOn(null);
    navigator.serviceWorker
      .getRegistration("/push-sw.js")
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => setPushOn(!!sub && Notification.permission === "granted"))
      .catch(() => setPushOn(false));
  }, []);

  async function enablePush() {
    if (isFigmaPreview) {
      setPushOn(true);
      toast.success("Avisos activados para esta sesión demo.");
      return;
    }
    if (!pushSupported()) {
      toast.error(
        "Este navegador no admite notificaciones. En iPhone, agregá Agendera a la pantalla de inicio.",
      );
      return;
    }
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        toast.error("No diste permiso para notificaciones.");
        return;
      }
      const reg = await navigator.serviceWorker.register("/push-sw.js");
      await navigator.serviceWorker.ready;
      const { publicKey } = await fetchKey();
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlB64ToUint8(publicKey),
        }));
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      await supabase
        .from("push_subscriptions" as never)
        .delete()
        .eq("endpoint", sub.endpoint);
      const { error } = await supabase
        .from("push_subscriptions" as never)
        .insert({ user_id: u.user.id, endpoint: sub.endpoint } as never);
      if (error) throw error;
      setPushOn(true);
      toast.success("Notificaciones activadas en este dispositivo.");
    } catch (e) {
      console.error(e);
      toast.error("No pudimos activar las notificaciones en este dispositivo.");
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    if (isFigmaPreview) {
      setPushOn(false);
      toast.success("Avisos desactivados para esta sesión demo.");
      return;
    }
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/push-sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await supabase
          .from("push_subscriptions" as never)
          .delete()
          .eq("endpoint", sub.endpoint);
        await sub.unsubscribe();
      }
      setPushOn(false);
      toast.success("Notificaciones desactivadas en este dispositivo.");
    } finally {
      setBusy(false);
    }
  }

  const count = pending.length;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={count ? `Notificaciones: ${count} solicitudes pendientes` : "Notificaciones"}
        >
          {count ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-4 py-3">
          <p className="font-semibold text-heading">Notificaciones</p>
          <p className="text-xs text-muted-foreground">
            {!admin
              ? "Recibí un aviso cuando un paciente reserva, reprograma o cancela un turno."
              : count
                ? `${count} solicitud${count > 1 ? "es" : ""} pendiente${count > 1 ? "s" : ""}`
                : "Sin solicitudes pendientes"}
          </p>
        </div>
        <ul className="max-h-72 overflow-y-auto">
          {pending.slice(0, 8).map((r) => (
            <li key={r.id} className="border-b px-4 py-2.5 last:border-0">
              <p className="text-sm font-medium">{r.full_name}</p>
              <p className="text-xs text-muted-foreground">
                {r.profession} · {ago(r.created_at)}
              </p>
            </li>
          ))}
        </ul>
        <div className="space-y-2 border-t p-3">
          {count > 0 && (
            <Button asChild size="sm" className="w-full">
              <Link to="/admin">Revisar en Administración</Link>
            </Button>
          )}
          {pushOn === null && !pushSupported() ? (
            <p className="text-xs text-muted-foreground">
              Este navegador no admite avisos. En iPhone, agregá Agendera a la pantalla de inicio.
            </p>
          ) : pushOn ? (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                disabled={busy}
                onClick={() => testPush().then(() => toast.success("Aviso de prueba enviado."))}
              >
                Probar aviso
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="flex-1"
                disabled={busy}
                onClick={disablePush}
              >
                Desactivar
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              disabled={busy}
              onClick={enablePush}
            >
              Activar avisos en este dispositivo
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
