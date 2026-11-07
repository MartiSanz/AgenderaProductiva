export type PlanId = "basic" | "pro";
export type FeatureId = "whatsapp_bot" | "patient_self_booking" | "public_directory";

export const PLAN_LABELS: Record<PlanId, string> = {
  basic: "Base",
  pro: "Pro",
};

export const FEATURE_LABELS: Record<FeatureId, string> = {
  whatsapp_bot: "Vinculación con WhatsApp",
  patient_self_booking: "Reserva autónoma del paciente",
  public_directory: "Aparecer en el portal de pacientes",
};

export const PLAN_FEATURES: Record<PlanId, FeatureId[]> = {
  basic: [],
  pro: ["whatsapp_bot", "patient_self_booking", "public_directory"],
};

/**
 * Funciones visibles en el panel de administrador.
 * `public_directory` queda fuera mientras el portal público (buscador/listado)
 * esté oculto: por ahora solo se usa el link personal de cada profesional.
 */
export const ADMIN_VISIBLE_FEATURES: FeatureId[] = ["whatsapp_bot", "patient_self_booking"];

export type Entitlements = {
  plan: PlanId;
  features: FeatureId[];
  status: "active" | "suspended";
  expiresAt: string | null;
  expired: boolean;
  paymentStatus: "paid" | "pending" | "overdue";
};

export const DEFAULT_ENTITLEMENTS: Entitlements = {
  plan: "basic",
  features: [],
  status: "active",
  expiresAt: null,
  expired: false,
  paymentStatus: "pending",
};

/** Plan features + admin overrides (an override can add or remove a feature). */
export function resolveFeatures(
  plan: PlanId,
  overrides: { feature: string; enabled: boolean }[],
): FeatureId[] {
  const set = new Set<FeatureId>(PLAN_FEATURES[plan] ?? []);
  for (const o of overrides) {
    const feature = o.feature as FeatureId;
    if (!(feature in FEATURE_LABELS)) continue;
    if (o.enabled) set.add(feature);
    else set.delete(feature);
  }
  return [...set];
}
