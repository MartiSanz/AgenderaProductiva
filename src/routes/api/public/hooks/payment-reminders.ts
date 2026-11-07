import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/payment-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { isAuthorizedCron } = await import("@/server/cronAuth.server");
        if (!(await isAuthorizedCron(request))) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { runPaymentReminders } = await import("@/server/billing.server");
        return Response.json({ ok: true, ...(await runPaymentReminders()) });
      },
    },
  },
});
