CREATE TABLE public.account_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  description text NOT NULL DEFAULT '',
  actor_id uuid,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX account_events_user_idx ON public.account_events(user_id, created_at DESC);
GRANT SELECT ON public.account_events TO authenticated;
GRANT ALL ON public.account_events TO service_role;
ALTER TABLE public.account_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read events" ON public.account_events FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'admin'));

CREATE TABLE public.account_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  period text NOT NULL,
  amount numeric(12,2) NOT NULL,
  paid_at date NOT NULL,
  reference text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX account_payments_user_idx ON public.account_payments(user_id, paid_at DESC);
GRANT SELECT ON public.account_payments TO authenticated;
GRANT ALL ON public.account_payments TO service_role;
ALTER TABLE public.account_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read payments" ON public.account_payments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'admin'));

CREATE TABLE public.reminder_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  appointment_id uuid,
  trigger text NOT NULL DEFAULT 'auto',
  status text NOT NULL,
  wa_message_id text,
  error text NOT NULL DEFAULT '',
  status_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reminder_attempts_owner_idx ON public.reminder_attempts(owner_id, created_at DESC);
CREATE INDEX reminder_attempts_msg_idx ON public.reminder_attempts(wa_message_id);
GRANT SELECT ON public.reminder_attempts TO authenticated;
GRANT ALL ON public.reminder_attempts TO service_role;
ALTER TABLE public.reminder_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read attempts" ON public.reminder_attempts FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'admin'));