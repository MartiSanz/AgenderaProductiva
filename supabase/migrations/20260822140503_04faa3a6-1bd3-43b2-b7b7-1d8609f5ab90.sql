-- 1. Private schema for internal, non-API-exposed helpers
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

-- 2. Repoint every policy that used public.has_role
DROP POLICY IF EXISTS own_roles_select ON public.user_roles;
CREATE POLICY own_roles_select ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS own_plan_select ON public.account_plans;
CREATE POLICY own_plan_select ON public.account_plans
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS admin_plan_write ON public.account_plans;
CREATE POLICY admin_plan_write ON public.account_plans
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS own_features_select ON public.plan_feature_overrides;
CREATE POLICY own_features_select ON public.plan_feature_overrides
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS admin_features_write ON public.plan_feature_overrides;
CREATE POLICY admin_features_write ON public.plan_feature_overrides
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

-- 3. Remove the API-exposed SECURITY DEFINER function
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);

-- 4. user_roles: explicit admin-only write policies (no self-service role escalation)
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

DROP POLICY IF EXISTS admin_roles_insert ON public.user_roles;
CREATE POLICY admin_roles_insert ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS admin_roles_update ON public.user_roles;
CREATE POLICY admin_roles_update ON public.user_roles
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS admin_roles_delete ON public.user_roles;
CREATE POLICY admin_roles_delete ON public.user_roles
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

-- 5. Connection tables stay backend-only and fail closed, made explicit
REVOKE ALL ON public.app_user_connections FROM anon, authenticated;
REVOKE ALL ON public.app_user_connection_slots FROM anon, authenticated;
GRANT ALL ON public.app_user_connections TO service_role;
GRANT ALL ON public.app_user_connection_slots TO service_role;

COMMENT ON TABLE public.app_user_connections IS
  'Stores ciphertext connection keys. Backend-only: no anon/authenticated grants or policies. Any user-facing connection status must go through a trusted server function.';
COMMENT ON TABLE public.app_user_connection_slots IS
  'Backend-only connector slot bookkeeping. No anon/authenticated grants or policies.';