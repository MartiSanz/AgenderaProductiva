import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const monthSchema = z.string().regex(/^\d{4}-\d{2}$/);

export const listAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ month: monthSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const { requireAdmin } = await import("@/server/entitlements.server");
    await requireAdmin(context.userId);
    const { listAdminAccounts } = await import("@/server/adminAccounts.server");
    return listAdminAccounts(data.month);
  });

export const getAccountDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid(), month: monthSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const { requireAdmin } = await import("@/server/entitlements.server");
    await requireAdmin(context.userId);
    const { getAdminAccountDetail } = await import("@/server/adminAccounts.server");
    return getAdminAccountDetail(data.user_id, data.month);
  });

const planPatch = z.object({
  user_id: z.string().uuid(),
  plan: z.enum(["basic", "pro"]).optional(),
  status: z.enum(["active", "suspended"]).optional(),
  payment_status: z.enum(["paid", "pending", "overdue"]).optional(),
  expires_at: z.string().max(10).nullable().optional(),
  last_payment_at: z.string().max(10).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  reason: z.string().max(500).optional(),
});

const PLAN = { basic: "Base", pro: "Pro" } as Record<string, string>;
const PAY = { paid: "Pagado", pending: "Pendiente", overdue: "Vencido" } as Record<string, string>;

export const updateAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => planPatch.parse(d))
  .handler(async ({ data, context }) => {
    const { requireAdmin } = await import("@/server/entitlements.server");
    await requireAdmin(context.userId);
    const { user_id, reason, ...patch } = data;
    const clean = Object.fromEntries(
      Object.entries(patch).map(([k, v]) => [k, v === "" ? null : v]),
    ) as Record<string, any>;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: before } = await db.from("account_plans").select("*").eq("user_id", user_id).maybeSingle();
    const { error } = await db
      .from("account_plans")
      .upsert({ user_id, ...clean, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);

    const { logAccountEvent } = await import("@/server/accountEvents.server");
    const prev = before ?? {};
    const log = (type: string, description: string, meta: Record<string, unknown> = {}) =>
      logAccountEvent({ userId: user_id, type, description, actorId: context.userId, meta });
    if (clean.plan !== undefined && clean.plan !== (prev.plan ?? "basic"))
      await log("plan_change", `Plan: ${PLAN[prev.plan ?? "basic"]} → ${PLAN[clean.plan]}`, { from: prev.plan, to: clean.plan });
    if (clean.status !== undefined && clean.status !== (prev.status ?? "active"))
      await log(
        clean.status === "suspended" ? "suspended" : "reactivated",
        `${clean.status === "suspended" ? "Cuenta suspendida" : "Cuenta reactivada"}${reason ? ` · Motivo: ${reason}` : ""}`,
        { reason: reason ?? "" },
      );
    if (clean.payment_status !== undefined && clean.payment_status !== (prev.payment_status ?? "pending"))
      await log("admin_change", `Estado de pago: ${PAY[prev.payment_status ?? "pending"]} → ${PAY[clean.payment_status]}`);
    if (clean.expires_at !== undefined && (clean.expires_at ?? null) !== (prev.expires_at ?? null))
      await log("admin_change", `Vencimiento: ${prev.expires_at ?? "—"} → ${clean.expires_at ?? "—"}`);
    if (clean.last_payment_at !== undefined && (clean.last_payment_at ?? null) !== (prev.last_payment_at ?? null))
      await log("admin_change", `Fecha de último pago: ${prev.last_payment_at ?? "—"} → ${clean.last_payment_at ?? "—"}`);
    if (clean.notes !== undefined && (clean.notes ?? "") !== (prev.notes ?? ""))
      await log("admin_change", "Notas internas modificadas");
    return { ok: true };
  });

export const addPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        period: monthSchema,
        amount: z.number().positive().max(100_000_000),
        paid_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        reference: z.string().trim().max(200).default(""),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { requireAdmin } = await import("@/server/entitlements.server");
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { error } = await db.from("account_payments").insert({ ...data, created_by: context.userId });
    if (error) throw new Error(error.message);
    const { data: planRow } = await db.from("account_plans").select("last_payment_at").eq("user_id", data.user_id).maybeSingle();
    const latest = !planRow?.last_payment_at || data.paid_at > planRow.last_payment_at ? data.paid_at : planRow.last_payment_at;
    await db
      .from("account_plans")
      .upsert({ user_id: data.user_id, last_payment_at: latest, payment_status: "paid", updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    const { logAccountEvent } = await import("@/server/accountEvents.server");
    await logAccountEvent({
      userId: data.user_id,
      type: "payment",
      description: `Pago registrado: $${data.amount.toLocaleString("es-AR")} · período ${data.period}${data.reference ? ` · Ref. ${data.reference}` : ""}`,
      actorId: context.userId,
      meta: data,
    });
    return { ok: true };
  });

export const setFeatureOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        feature: z.enum(["whatsapp_bot", "patient_self_booking"]),
        value: z.enum(["default", "on", "off"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { requireAdmin } = await import("@/server/entitlements.server");
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    if (data.value === "default") {
      const { error } = await db
        .from("plan_feature_overrides")
        .delete()
        .eq("user_id", data.user_id)
        .eq("feature", data.feature);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await db.from("plan_feature_overrides").upsert(
        {
          user_id: data.user_id,
          feature: data.feature,
          enabled: data.value === "on",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,feature" },
      );
      if (error) throw new Error(error.message);
    }
    const { logAccountEvent } = await import("@/server/accountEvents.server");
    const { FEATURE_LABELS } = await import("@/lib/entitlements");
    const label = (FEATURE_LABELS as Record<string, string>)[data.feature] ?? data.feature;
    const state = { default: "según el plan", on: "forzada activada", off: "forzada desactivada" }[data.value];
    await logAccountEvent({ userId: data.user_id, type: "admin_change", description: `${label}: ${state}`, actorId: context.userId });
    return { ok: true };
  });

export const listWhatsappSpendHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireAdmin } = await import("@/server/entitlements.server");
    await requireAdmin(context.userId);
    const { listWhatsappHistory } = await import("@/server/adminAccounts.server");
    return listWhatsappHistory();
  });

/** Elimina definitivamente una cuenta (no admin) y sus datos. */
export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { requireAdmin } = await import("@/server/entitlements.server");
    await requireAdmin(context.userId);
    if (data.user_id === context.userId) throw new Error("No podés eliminar tu propia cuenta.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: role } = await db.from("user_roles").select("id").eq("user_id", data.user_id).eq("role", "admin").maybeSingle();
    if (role) throw new Error("No se puede eliminar una cuenta de administrador.");
    const { data: u, error: ue } = await supabaseAdmin.auth.admin.getUserById(data.user_id);
    if (ue || !u?.user) throw new Error("Cuenta no encontrada.");
    await db.from("app_user_connections").delete().eq("user_id", data.user_id);
    await db.from("app_user_connection_slots").delete().eq("user_id", data.user_id);
    if (u.user.email) await db.from("access_requests").delete().eq("email", u.user.email);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
