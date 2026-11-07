import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Publishes / removes the all-day "Licencia" event in the dedicated calendar. */
async function publishTimeOffEvent(
  supabase: any,
  userId: string,
  period: { id: string; start_date: string; end_date: string; reason: string },
): Promise<void> {
  if (process.env.VITE_FIGMA_AUTH_BYPASS === "1") return;
  const { CONNECTOR_ID, resolveTurnosCalendarId, insertAllDayEvent } =
    await import("@/server/googleCalendar.server");
  const { getConnectionKeyForUser } = await import("@/server/appUserConnections.server");
  const key = await getConnectionKeyForUser(userId, CONNECTOR_ID);
  if (!key) return;
  const calendarId = await resolveTurnosCalendarId(supabase, userId, key);
  const eventId = await insertAllDayEvent(key, calendarId, {
    summary: period.reason ? `Licencia: ${period.reason}` : "Licencia",
    startDate: period.start_date,
    endDate: period.end_date,
    kind: "time_off",
    props: { time_off_id: period.id },
  });
  await supabase.from("time_off").update({ calendar_event_id: eventId }).eq("id", period.id);
}

async function removeTimeOffEvent(supabase: any, userId: string, eventId: string): Promise<void> {
  if (process.env.VITE_FIGMA_AUTH_BYPASS === "1") return;
  if (!eventId) return;
  const { CONNECTOR_ID, resolveTurnosCalendarId, removeEvent } =
    await import("@/server/googleCalendar.server");
  const { getConnectionKeyForUser } = await import("@/server/appUserConnections.server");
  const key = await getConnectionKeyForUser(userId, CONNECTOR_ID);
  if (!key) return;
  const calendarId = await resolveTurnosCalendarId(supabase, userId, key);
  await removeEvent(key, calendarId, eventId);
}

export const getMySchedule = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("weekly_schedule")
      .select("*")
      .eq("owner_id", context.userId)
      .order("day_of_week")
      .order("start_time");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const slotsSchema = z.object({
  slots: z
    .array(
      z
        .object({
          day_of_week: z.number().int().min(0).max(6),
          start_time: z.string().regex(/^\d{2}:\d{2}$/),
          end_time: z.string().regex(/^\d{2}:\d{2}$/),
          location_id: z
            .string()
            .uuid({ message: "Cada franja horaria debe tener un lugar de atención asignado" }),
        })
        .refine((s) => s.end_time > s.start_time, {
          message: "La hora de fin debe ser posterior a la hora de inicio",
          path: ["end_time"],
        }),
    )
    .superRefine((slots, ctx) => {
      const seen = new Set<string>();
      slots.forEach((s, i) => {
        const key = `${s.day_of_week}|${s.start_time}|${s.end_time}`;
        if (seen.has(key)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [i, "start_time"],
            message: "No se puede guardar dos veces el mismo día con la misma franja horaria",
          });
        }
        seen.add(key);
      });
    }),
});

export const replaceMySchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => slotsSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const del = await supabase.from("weekly_schedule").delete().eq("owner_id", userId);
    if (del.error) throw new Error(del.error.message);
    if (data.slots.length > 0) {
      const ins = await supabase.from("weekly_schedule").insert(
        data.slots.map((s) => ({
          day_of_week: s.day_of_week,
          start_time: s.start_time,
          end_time: s.end_time,
          location_id: s.location_id ?? null,
          owner_id: userId,
        })),
      );
      if (ins.error) throw new Error(ins.error.message);
    }
    return { ok: true };
  });

export const getMyTimeOff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("time_off")
      .select("*")
      .eq("owner_id", context.userId)
      .order("start_date");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const addTimeOff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        start_date: z.string(),
        end_date: z.string(),
        reason: z.string().max(200),
        start_time: z
          .string()
          .regex(/^\d{2}:\d{2}$/)
          .nullable()
          .optional(),
        end_time: z
          .string()
          .regex(/^\d{2}:\d{2}$/)
          .nullable()
          .optional(),
      })
      .refine(
        (v) =>
          (!v.start_time && !v.end_time) ||
          (!!v.start_time && !!v.end_time && v.end_time > v.start_time),
        {
          message: "La hora de fin debe ser posterior a la de inicio",
        },
      )
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("time_off")
      .insert({
        ...data,
        start_time: data.start_time || null,
        end_time: data.end_time || null,
        owner_id: context.userId,
      })
      .select("id, start_date, end_date, reason, start_time")
      .single();
    if (error) throw new Error(error.message);
    // Google errors must not block the local operation: the periodic sync retries.
    if (!row.start_time)
      await publishTimeOffEvent(context.supabase, context.userId, row as any).catch((err) =>
        console.error("time_off calendar publish failed", err),
      );
    return { ok: true };
  });

export const deleteTimeOff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("time_off")
      .select("calendar_event_id")
      .eq("id", data.id)
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (existing?.calendar_event_id) {
      await removeTimeOffEvent(context.supabase, context.userId, existing.calendar_event_id).catch(
        (err) => console.error("time_off calendar delete failed", err),
      );
    }
    const { error } = await context.supabase
      .from("time_off")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
/** Jornadas por fecha y sede. */
export const getMyDateBlocks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("schedule_date_blocks")
      .select("id, location_id, start_date, end_date, start_time, end_time, day_of_week")
      .eq("owner_id", context.userId)
      .order("start_date");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const bandSchema = z
  .object({
    start_time: z.string().regex(/^\d{2}:\d{2}$/),
    end_time: z.string().regex(/^\d{2}:\d{2}$/),
  })
  .refine((v) => v.end_time > v.start_time, {
    message: "La hora de fin debe ser posterior a la de inicio",
  });

export const addDateBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        location_id: z.string().uuid({ message: "Elegí la sede" }),
        start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        days: z
          .array(
            z.object({
              day_of_week: z.number().int().min(0).max(6),
              bands: z.array(bandSchema).min(1).max(6),
            }),
          )
          .min(1, "Cargá horarios para al menos un día"),
      })
      .refine((v) => v.end_date >= v.start_date, {
        message: "La fecha «hasta» debe ser igual o posterior a «desde»",
      })
      .refine(
        (v) =>
          v.days.every((d) => {
            const sorted = [...d.bands].sort((x, y) => x.start_time.localeCompare(y.start_time));
            return sorted.every((b, i) => i === 0 || b.start_time >= sorted[i - 1].end_time);
          }),
        { message: "Las franjas horarias de un mismo día no pueden superponerse" },
      )
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const rows = data.days.flatMap((d) =>
      d.bands.map((b) => ({
        owner_id: context.userId,
        location_id: data.location_id,
        start_date: data.start_date,
        end_date: data.end_date,
        day_of_week: d.day_of_week,
        start_time: b.start_time,
        end_time: b.end_time,
      })),
    );
    const { error } = await context.supabase.from("schedule_date_blocks").insert(rows);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteDateBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("schedule_date_blocks")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Weekly bands plus dated workdays, for availability and location lookups. */
export const getMyBookingSchedule = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { dateBlocksAsBands } = await import("@/lib/domain/dateBlocks");
    const [weekly, dated] = await Promise.all([
      context.supabase.from("weekly_schedule").select("*").eq("owner_id", context.userId),
      context.supabase.from("schedule_date_blocks").select("*").eq("owner_id", context.userId),
    ]);
    if (weekly.error) throw new Error(weekly.error.message);
    return [...(weekly.data ?? []), ...dateBlocksAsBands(dated.data ?? [])] as any[];
  });
