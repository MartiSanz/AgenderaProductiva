import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/calendar-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { isAuthorizedCron } = await import("@/server/cronAuth.server");
        if (!(await isAuthorizedCron(request))) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { syncDueOwners } = await import("@/server/calendarSync.server");
        try {
          const result = await syncDueOwners();
          return Response.json({ ok: true, ...result });
        } catch (err) {
          console.error("calendar-sync failed", err);
          return new Response(
            JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
