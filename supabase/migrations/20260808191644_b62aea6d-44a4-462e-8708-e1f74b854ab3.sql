-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "own_roles_select" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Bootstrap admin
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users WHERE email = 'msanzcaparros@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Planes por cuenta
CREATE TABLE public.account_plans (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'basic',
  expires_at date,
  status text NOT NULL DEFAULT 'active',
  payment_status text NOT NULL DEFAULT 'pending',
  last_payment_at date,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.account_plans TO authenticated;
GRANT ALL ON public.account_plans TO service_role;
ALTER TABLE public.account_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_plan_select" ON public.account_plans
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_plan_write" ON public.account_plans
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_account_plans_updated
  BEFORE UPDATE ON public.account_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Excepciones de funciones
CREATE TABLE public.plan_feature_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, feature)
);

GRANT SELECT ON public.plan_feature_overrides TO authenticated;
GRANT ALL ON public.plan_feature_overrides TO service_role;
ALTER TABLE public.plan_feature_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_features_select" ON public.plan_feature_overrides
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_features_write" ON public.plan_feature_overrides
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_plan_feature_overrides_updated
  BEFORE UPDATE ON public.plan_feature_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Fila de plan para cuentas existentes
INSERT INTO public.account_plans (user_id, plan)
SELECT id, 'basic' FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- Crear plan al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.professional_config (owner_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, 'Profesional'))
  ON CONFLICT (owner_id) DO NOTHING;

  INSERT INTO public.account_plans (user_id, plan)
  VALUES (NEW.id, 'basic')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$function$;