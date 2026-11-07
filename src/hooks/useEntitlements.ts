import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMyEntitlements } from "@/lib/api/entitlements.functions";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_ENTITLEMENTS, PLAN_FEATURES, type FeatureId } from "@/lib/entitlements";
import { isFigmaPreview } from "@/lib/figmaPreview";

/** Reads the plan/features of the signed-in user. Stays idle when there is no session. */
export function useEntitlements() {
  const [hasSession, setHasSession] = useState<boolean | null>(isFigmaPreview ? true : null);

  useEffect(() => {
    if (isFigmaPreview) return;
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setHasSession(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const query = useQuery({
    queryKey: ["entitlements"],
    queryFn: () => getMyEntitlements(),
    enabled: !isFigmaPreview && hasSession === true,
    staleTime: 60_000,
    retry: false,
  });

  const data = isFigmaPreview
    ? {
        ...DEFAULT_ENTITLEMENTS,
        plan: "pro" as const,
        features: PLAN_FEATURES.pro,
        paymentStatus: "paid" as const,
        isAdmin: true,
        accessApproved: true,
        canImportPatients: true,
      }
    : (query.data ?? {
        ...DEFAULT_ENTITLEMENTS,
        isAdmin: false,
        accessApproved: false,
        canImportPatients: false,
      });
  return {
    ...data,
    isLoading: !isFigmaPreview && (hasSession === null || query.isLoading),
    has: (feature: FeatureId) => data.features.includes(feature),
  };
}
