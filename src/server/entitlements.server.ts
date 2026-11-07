import { resolveFeatures, type FeatureId, type PlanId } from "@/lib/entitlements";

/** Server-side source of truth: resolves a user's plan + overrides with admin access. */
export async function getEntitlementsFor(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;

  const [{ data: planRow }, { data: overrides }] = await Promise.all([
    db.from("account_plans").select("plan, status").eq("user_id", userId).maybeSingle(),
    db.from("plan_feature_overrides").select("feature, enabled").eq("user_id", userId),
  ]);

  const plan = (planRow?.plan === "pro" ? "pro" : "basic") as PlanId;
  return {
    plan,
    status: (planRow?.status === "suspended" ? "suspended" : "active") as "active" | "suspended",
    features: resolveFeatures(plan, overrides ?? []),
  };
}

export async function hasFeature(userId: string, feature: FeatureId) {
  const ent = await getEntitlementsFor(userId);
  return ent.status === "active" && ent.features.includes(feature);
}

export async function requireFeature(userId: string, feature: FeatureId) {
  if (!(await hasFeature(userId, feature))) {
    throw new Error("Esta función no está habilitada en tu plan.");
  }
}

export async function requireAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any)
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
}
