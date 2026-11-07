import { createFileRoute } from "@tanstack/react-router";

// The service worker asks for the latest message of its own (unguessable) push endpoint.
export const Route = createFileRoute("/api/public/push-message")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => null)) as { endpoint?: unknown } | null;
        const endpoint = typeof body?.endpoint === "string" ? body.endpoint.slice(0, 1000) : "";
        if (!endpoint.startsWith("https://")) return new Response("Bad request", { status: 400 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await (supabaseAdmin as any)
          .from("push_subscriptions")
          .select("last_title, last_body, last_url")
          .eq("endpoint", endpoint)
          .maybeSingle();
        if (!data?.last_title) return new Response("Not found", { status: 404 });
        return Response.json({ title: data.last_title, body: data.last_body ?? "", url: data.last_url ?? "/" });
      },
    },
  },
});
