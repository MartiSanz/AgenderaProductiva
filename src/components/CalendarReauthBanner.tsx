import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { waitForOAuthCompletion } from "@/lib/oauthPopup";
import {
  getCalendarConnectionStatus,
  getTurnosCalendarStatus,
  startGoogleCalendarConnect,
  completeGoogleCalendarConnect,
} from "@/lib/api/calendar.functions";
import { isFigmaPreview } from "@/lib/figmaPreview";

/**
 * Global notice shown right after signing in when the Google Calendar
 * authorization expired, so the professional can reconnect without going
 * into Configuración.
 */
export function CalendarReauthBanner() {
  const statusFn = useServerFn(getCalendarConnectionStatus);
  const turnosStatusFn = useServerFn(getTurnosCalendarStatus);
  const start = useServerFn(startGoogleCalendarConnect);
  const complete = useServerFn(completeGoogleCalendarConnect);
  const qc = useQueryClient();
  const [dismissed, setDismissed] = useState(false);
  const [ready, setReady] = useState(isFigmaPreview);

  // Only query once a client-side Supabase session exists: server functions
  // guarded by requireSupabaseAuth throw during SSR / before hydration.
  useEffect(() => {
    if (isFigmaPreview) return;
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setReady(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setReady(!!session);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const { data: conn } = useQuery({
    queryKey: ["calendar-status"],
    queryFn: () => statusFn(),
    enabled: ready,
    retry: false,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const { data: cal } = useQuery({
    queryKey: ["turnos-calendar"],
    queryFn: () => turnosStatusFn(),
    enabled: ready && !!conn?.connected,
    retry: false,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const reconnect = useMutation({
    mutationFn: async () => {
      const popup = window.open("", "lovable-oauth", "width=600,height=720");
      if (!popup)
        throw new Error("El navegador bloqueó la ventana. Permití popups y probá de nuevo.");
      const { authorizationUrl } = await start({ data: { origin: window.location.origin } });
      const completion = waitForOAuthCompletion(popup, "google_calendar");
      popup.location.href = authorizationUrl;
      const code = await completion;
      if (code) await complete({ data: { code } });
    },
    onSuccess: () => {
      toast.success("Google Calendar reconectado. Se van a sincronizar los turnos pendientes.");
      qc.invalidateQueries({ queryKey: ["calendar-status"] });
      qc.invalidateQueries({ queryKey: ["turnos-calendar"] });
    },
    onError: (e: Error) => toast.error(e.message || "No se pudo reconectar Google Calendar"),
  });

  if (dismissed || !conn?.connected || !cal?.needsReauth) return null;

  return (
    <div className="mx-auto mb-4 flex max-w-7xl items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-destructive">Google Calendar se desincronizó</p>
        <p className="mt-1 text-xs text-muted-foreground">
          El permiso de Google venció y los turnos nuevos no se están escribiendo en tu calendario.
          Reconectá tu cuenta y se sincronizan automáticamente los turnos pendientes.
        </p>
        <Button
          size="sm"
          className="mt-3"
          onClick={() => reconnect.mutate()}
          disabled={reconnect.isPending}
        >
          {reconnect.isPending ? "Reconectando…" : "Reconectar Google Calendar"}
        </Button>
      </div>
      <button
        aria-label="Cerrar aviso"
        onClick={() => setDismissed(true)}
        className="text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
