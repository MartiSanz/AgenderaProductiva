CREATE TABLE public.billing_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  amount_basic numeric(12,2) NOT NULL DEFAULT 10000,
  amount_pro numeric(12,2) NOT NULL DEFAULT 10000,
  alias text NOT NULL DEFAULT '',
  receipt_phone text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.billing_settings TO authenticated;
GRANT ALL ON public.billing_settings TO service_role;
ALTER TABLE public.billing_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read billing settings" ON public.billing_settings FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'admin'));
INSERT INTO public.billing_settings (id, amount_basic, amount_pro, alias, receipt_phone) VALUES (1, 10000, 10000, 'sanz.martina', '2281565356');