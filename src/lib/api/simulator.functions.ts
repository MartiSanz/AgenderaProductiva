import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listSimMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ phone: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("sim_messages")
      .select("*")
      .eq("owner_id", context.userId)
      .eq("phone", data.phone)
      .order("created_at");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const appendSimMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        phone: z.string(),
        direction: z.enum(["in", "out"]),
        body: z.string(),
        meta: z.record(z.string(), z.any()).optional().default({}),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("sim_messages")
      .insert({ ...data, owner_id: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const clearSimMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ phone: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("sim_messages")
      .delete()
      .eq("owner_id", context.userId)
      .eq("phone", data.phone);
    if (error) throw new Error(error.message);
    return { ok: true };
  });