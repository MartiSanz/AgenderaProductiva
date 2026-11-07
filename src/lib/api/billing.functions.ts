import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const period = z.string().regex(/^\d{4}-\d{2}$/);

async function guard(userId: string) {
  const { requireAdmin } = await import("@/server/entitlements.server");
  await requireAdmin(userId);
}

export const getBilling = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ period }).parse(d))
  .handler(async ({ data, context }) => {
    await guard(context.userId);
    const { getBillingOverview } = await import("@/server/billing.server");
    return getBillingOverview(data.period);
  });

export const updateBillingSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        amount_basic: z.number().min(0).max(100_000_000),
        amount_pro: z.number().min(0).max(100_000_000),
        alias: z.string().trim().min(1).max(60),
        receipt_phone: z.string().trim().min(6).max(30),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await guard(context.userId);
    const { saveBillingSettings } = await import("@/server/billing.server");
    await saveBillingSettings(data);
    return { ok: true };
  });

export const getPackPrices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await guard(context.userId);
    const { listPackPrices } = await import("@/server/billing.server");
    return listPackPrices();
  });

export const updatePackPrices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ packs: z.array(z.object({ id: z.string().uuid(), price_ars: z.number().min(0).max(100_000_000) })).max(50) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await guard(context.userId);
    const { savePackPrices } = await import("@/server/billing.server");
    await savePackPrices(data.packs);
    return { ok: true };
  });

export const setProfessionalPhone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ user_id: z.string().uuid(), phone: z.string().trim().min(6).max(30) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await guard(context.userId);
    const { normalizeArPhone } = await import("@/lib/phone");
    const { saveProfessionalPhone } = await import("@/server/billing.server");
    await saveProfessionalPhone(data.user_id, normalizeArPhone(data.phone));
    return { ok: true };
  });

export const sendManualPaymentReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid(), period }).parse(d))
  .handler(async ({ data, context }) => {
    await guard(context.userId);
    const { getBillingOverview, sendPaymentReminder } = await import("@/server/billing.server");
    const o = await getBillingOverview(data.period);
    const row = o.rows.find((r) => r.user_id === data.user_id);
    if (!row) throw new Error("Cuenta no encontrada.");
    try {
      const res = await sendPaymentReminder(row, data.period, o.settings, { actorId: context.userId, kind: "manual" });
      return { ok: true, to: res.to };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  });

export const setPaymentReminders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid(), enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await guard(context.userId);
    const { setPaymentRemindersEnabled } = await import("@/server/billing.server");
    await setPaymentRemindersEnabled(data.user_id, data.enabled, context.userId);
    return { ok: true };
  });
