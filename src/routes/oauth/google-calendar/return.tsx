import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/oauth/google-calendar/return")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Conexión con Google Calendar — Agendera" },
      { name: "description", content: "Finalizá la conexión de tu agenda con Google Calendar." },
      { property: "og:title", content: "Conexión con Google Calendar — Agendera" },
      { property: "og:description", content: "Finalizá la conexión de tu agenda con Google Calendar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OAuthReturn,
});

function OAuthReturn() {
  const [message, setMessage] = useState("Finalizando conexión con Google Calendar…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const opener = window.opener as Window | null;
    const notifyOpenerAndClose = (
      type: "appUserConnectorOAuthComplete" | "appUserConnectorOAuthFailed",
      payload?: { error?: string; code?: string },
    ) => {
      opener?.postMessage(
        { type, connectorId: "google_calendar", ...payload },
        window.location.origin,
      );
      window.close();
    };

    if (!opener) {
      setMessage(
        "La autorización se completó, pero esta ventana perdió el vínculo con la app. Volvé a Configuración y presioná «Conectar Google Calendar» otra vez.",
      );
      return;
    }

    if (params.get("success") !== "true") {
      const error = params.get("error") ?? "La conexión no se completó.";
      setMessage(error);
      notifyOpenerAndClose("appUserConnectorOAuthFailed", { error });
      return;
    }

    const code = params.get("code");
    if (!code) {
      setMessage("La conexión no devolvió un código válido.");
      notifyOpenerAndClose("appUserConnectorOAuthFailed", {
        error: "La conexión no devolvió un código válido.",
      });
      return;
    }

    setMessage("Autorización completada. Volviendo a la app…");
    notifyOpenerAndClose("appUserConnectorOAuthComplete", { code });
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <p className="text-center text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
