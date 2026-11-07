import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getVapidPublicKey = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getVapidKeys } = await import("@/server/webPush.server");
    return { publicKey: (await getVapidKeys()).publicKey };
  });

export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { sendPushToUsers } = await import("@/server/webPush.server");
    return sendPushToUsers([context.userId], {
      title: "Aviso de prueba",
      body: "Las notificaciones de Agendera funcionan en este dispositivo.",
      url: "/agenda",
    });
  });
