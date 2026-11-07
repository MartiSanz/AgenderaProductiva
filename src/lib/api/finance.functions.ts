import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function guard(userId: string) {
  const { requireAdmin } = await import("@/server/entitlements.server");
  await requireAdmin(userId);
}

export const getFinance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await guard(context.userId);
    const { getFinanceData } = await import("@/server/finance.server");
    return getFinanceData();
  });

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const entrySchema = z.object({
  id: z.string().uuid().optional(),
  concept: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(80),
  kind: z.enum(["investment", "operating"]),
  frequency: z.enum(["once", "monthly", "yearly"]),
  currency: z.enum(["ARS", "USD"]),
  amount: z.number().nonnegative().max(1e12),
  fx_rate: z.number().positive().max(1e7).nullable(),
  entry_date: date,
  end_date: date.nullable(),
  provider: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
}).refine((e) => e.currency === "ARS" || e.fx_rate, { message: "Cargá el tipo de cambio." })
  .refine((e) => !e.end_date || e.end_date >= e.entry_date, { message: "La fecha de fin es anterior al inicio." });

export const saveFinanceEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => entrySchema.parse(d))
  .handler(async ({ data, context }) => {
    await guard(context.userId);
    const { saveEntry } = await import("@/server/finance.server");
    return saveEntry(data as any, context.userId);
  });

export const deleteFinanceEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await guard(context.userId);
    const { deleteEntry } = await import("@/server/finance.server");
    return deleteEntry(data.id, context.userId);
  });

export const changeFinancePrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), from: date, amount: z.number().nonnegative(), fx_rate: z.number().positive().nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    await guard(context.userId);
    const { changeRecurringPrice } = await import("@/server/finance.server");
    return changeRecurringPrice(data.id, data.from, data.amount, data.fx_rate, context.userId);
  });
