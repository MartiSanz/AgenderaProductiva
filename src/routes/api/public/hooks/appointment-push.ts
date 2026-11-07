import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Body = z.object({ appointment_id: z.string().uuid() });

export const Route = createFileRoute("/api/public/hooks/appointment-push")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { isAuthorizedCron } = await import("@/server/cronAuth.server");
        if (!(await isAuthorizedCron(request))) return new Response("Unauthorized", { status: 401 });
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("Bad request", { status: 400 });
        const { notifyNewAppointmentPush } = await import("@/server/webPush.server");
        return Response.json({ ok: true, ...(await notifyNewAppointmentPush(parsed.data.appointment_id)) });
      },
    },
  },
});
