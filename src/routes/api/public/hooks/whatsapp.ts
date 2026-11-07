import { createFileRoute } from "@tanstack/react-router";

type IncomingMessage = {
  id: string;
  from: string;
  type: string;
  text?: { body: string };
  button?: { text: string };
  interactive?: { button_reply?: { title: string }; list_reply?: { title: string } };
};

function messageText(msg: IncomingMessage): string {
  if (msg.type === "text") return msg.text?.body ?? "";
  if (msg.type === "button") return msg.button?.text ?? "";
  if (msg.type === "interactive")
    return msg.interactive?.button_reply?.title ?? msg.interactive?.list_reply?.title ?? "";
  return "";
}

export const Route = createFileRoute("/api/public/hooks/whatsapp")({
  server: {
    handlers: {
      // Meta webhook verification handshake
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge") ?? "";
        if (mode !== "subscribe" || !token) return new Response("Forbidden", { status: 403 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await (supabaseAdmin as any)
          .from("whatsapp_accounts")
          .select("owner_id")
          .eq("verify_token", token)
          .maybeSingle();
        if (!data) return new Response("Forbidden", { status: 403 });
        return new Response(challenge, { headers: { "Content-Type": "text/plain" } });
      },

      POST: async ({ request }) => {
        const raw = await request.text();
        const signature = request.headers.get("x-hub-signature-256");

        const wa = await import("@/server/whatsapp.server");

        let payload: any;
        try {
          payload = JSON.parse(raw);
        } catch {
          return new Response("Bad payload", { status: 400 });
        }

        const entries = payload?.entry ?? [];
        for (const entry of entries) {
          for (const change of entry?.changes ?? []) {
            const value = change?.value;
            const phoneNumberId = value?.metadata?.phone_number_id;
            if (!phoneNumberId) continue;

            const account = await wa.getSharedAccount();
            if (!account || account.phone_number_id !== phoneNumberId) continue;
            if (!wa.verifySignature(account.app_secret, raw, signature)) {
              return new Response("Invalid signature", { status: 401 });
            }

            // Estados de entrega de los recordatorios (enviado → entregado → leído / fallido).
            for (const st of (value?.statuses ?? []) as any[]) {
              if (!st?.id || !st?.status) continue;
              const { applyReminderStatus } = await import("@/server/accountEvents.server");
              await applyReminderStatus(st.id, st.status, st.timestamp, st.errors?.[0]?.title ?? st.errors?.[0]?.message);
            }

            // Número compartido: solo envía recordatorios; los mensajes entrantes se ignoran.
          }
        }

        return new Response("ok");
      },
    },
  },
});