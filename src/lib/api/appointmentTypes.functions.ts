import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyAppointmentTypes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("appointment_types")
      .select("*")
      .eq("owner_id", context.userId)
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const typeSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "El nombre es obligatorio").max(120),
  duration_minutes: z.number().int().min(5).max(480),
  price_ars: z.number().min(0).max(100000000).nullable().optional(),
});

export const saveAppointmentType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => typeSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.id) {
      const { error } = await supabase
        .from("appointment_types")
        .update({ name: data.name, duration_minutes: data.duration_minutes, ...(data.price_ars !== undefined ? { price_ars: data.price_ars } : {}) })
        .eq("id", data.id)
        .eq("owner_id", userId);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await supabase
      .from("appointment_types")
      .insert({ owner_id: userId, name: data.name, duration_minutes: data.duration_minutes, price_ars: data.price_ars ?? null })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

export const deleteAppointmentType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("appointment_types")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
