CREATE TABLE public.finance_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.finance_categories TO authenticated;
GRANT ALL ON public.finance_categories TO service_role;
ALTER TABLE public.finance_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read finance categories" ON public.finance_categories FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));
INSERT INTO public.finance_categories (name) VALUES
('Desarrollo'),('Dominio'),('Hosting e infraestructura'),('Lovable'),('Supabase'),('WhatsApp Business API'),('Cuenta o número de WhatsApp'),('Google Cloud'),('Servicios externos'),('Publicidad y marketing'),('Diseño'),('Comisiones e impuestos'),('Otros');

CREATE TABLE public.finance_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  concept text NOT NULL,
  category text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('investment','operating')),
  frequency text NOT NULL DEFAULT 'once' CHECK (frequency IN ('once','monthly','yearly')),
  currency text NOT NULL DEFAULT 'ARS' CHECK (currency IN ('ARS','USD')),
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  fx_rate numeric(14,4),
  amount_ars numeric(14,2) NOT NULL,
  entry_date date NOT NULL,
  end_date date,
  provider text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  deleted_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (currency = 'ARS' OR fx_rate IS NOT NULL)
);
GRANT SELECT ON public.finance_entries TO authenticated;
GRANT ALL ON public.finance_entries TO service_role;
ALTER TABLE public.finance_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read finance entries" ON public.finance_entries FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE public.finance_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL,
  action text NOT NULL,
  before jsonb,
  after jsonb,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.finance_audit TO authenticated;
GRANT ALL ON public.finance_audit TO service_role;
ALTER TABLE public.finance_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read finance audit" ON public.finance_audit FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));