import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  DEFAULT_ENTITLEMENTS,
  resolveFeatures,
  type Entitlements,
  type PlanId,
} from "@/lib/entitlements";

const PATIENT_IMPORT_EMAILS = ["micaelamascietti@gmail.com"];

export const getMyEntitlements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<Entitlements & { isAdmin: boolean; accessApproved: boolean; canImportPatients: boolean }> => {
    const db = context.supabase as any;

    const email = (context.claims as { email?: string } | undefined)?.email ?? "";

    const [{ data: planRow }, { data: overrides }, { data: adminRow }, { data: accessRow }] = await Promise.all([
      db.from("account_plans").select("*").eq("user_id", context.userId).maybeSingle(),
      db.from("plan_feature_overrides").select("feature, enabled").eq("user_id", context.userId),
      // Role check runs as the caller under RLS: they can only ever read their own role rows.
      db
        .from("user_roles")
        .select("role")
        .eq("user_id", context.userId)
        .eq("role", "admin")
        .maybeSingle(),
      // Solicitud de acceso aprobada por la administradora (RLS: solo la propia).
      db.from("access_requests").select("status").ilike("email", email).maybeSingle(),
    ]);

    const isAdmin = !!adminRow;
    const accessApproved = isAdmin || accessRow?.status === "approved";
    // Importar pacientes desde planilla: solo administradoras y cuentas puntuales.
    const canImportPatients = isAdmin || PATIENT_IMPORT_EMAILS.includes(email.trim().toLowerCase());

    if (!planRow) return { ...DEFAULT_ENTITLEMENTS, isAdmin, accessApproved, canImportPatients };

    const plan = (planRow.plan === "pro" ? "pro" : "basic") as PlanId;
    const expiresAt: string | null = planRow.expires_at ?? null;

    return {
      plan,
      // Expiry never downgrades the plan; it only flags the account for the admin.
      features: resolveFeatures(plan, overrides ?? []),
      status: planRow.status === "suspended" ? "suspended" : "active",
      expiresAt,
      expired: !!expiresAt && new Date(`${expiresAt}T23:59:59`) < new Date(),
      paymentStatus: planRow.payment_status ?? "pending",
      isAdmin,
      accessApproved,
      canImportPatients,
    };
  },
);
