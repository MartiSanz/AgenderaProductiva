import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getMessageOverview } = await import("@/server/messageCredits.server");
    return getMessageOverview(context.userId);
  });

export const buyMessagePack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { packId: string }) => z.object({ packId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { purchasePack } = await import("@/server/messageCredits.server");
    await purchasePack(context.userId, data.packId);
    return { ok: true };
  });
