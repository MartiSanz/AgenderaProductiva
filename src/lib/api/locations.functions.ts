import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyLocations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("locations")
      .select("*")
      .eq("owner_id", context.userId)
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const locationSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "El nombre es obligatorio").max(120),
  address: z.string().max(240).default(""),
  maps_url: z.string().max(500).default(""),
  city: z.string().max(120).optional(),
});

export const saveLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => locationSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const city = data.city === undefined ? {} : { city: data.city.trim() };
    if (data.id) {
      const { error } = await supabase
        .from("locations")
        .update({ name: data.name, address: data.address, maps_url: data.maps_url, ...city })
        .eq("id", data.id)
        .eq("owner_id", userId);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await supabase
      .from("locations")
      .insert({ owner_id: userId, name: data.name, address: data.address, maps_url: data.maps_url, ...city })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

export const deleteLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("locations")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
