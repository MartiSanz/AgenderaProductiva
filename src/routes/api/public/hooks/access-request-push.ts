import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/access-request-push")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { isAuthorizedCron } = await import("@/server/cronAuth.server");
        if (!(await isAuthorizedCron(request))) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { notifyAdminsPush } = await import("@/server/webPush.server");
        return Response.json({ ok: true, ...(await notifyAdminsPush()) });
      },
    },
  },
});
