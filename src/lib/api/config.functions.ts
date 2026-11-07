import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("professional_config")
      .select("*")
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

const configSchema = z.object({
  display_name: z.string().min(1).max(120),
  specialty: z.string().max(120),
  address: z.string().max(240),
  phone: z.string().max(60),
  maps_url: z.string().max(500),
  appointment_duration_minutes: z.number().int().refine((v) => [15, 20, 30, 45, 60].includes(v)),
  reminder_hour: z.number().int().min(9).max(19),
  non_working_days: z.array(z.number().int().min(0).max(6)).max(7).default([]),
  max_active_appointments_per_patient: z.number().int().min(1).max(50).default(1),
});

export const updateBookingAccessMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ mode: z.enum(["open", "whitelist"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("professional_config")
      .update({ booking_access_mode: data.mode })
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateMyConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => configSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("professional_config")
      .update(data)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });