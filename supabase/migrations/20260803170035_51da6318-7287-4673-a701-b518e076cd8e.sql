CREATE TABLE public.whatsapp_accounts (
  owner_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number_id TEXT NOT NULL UNIQUE,
  waba_id TEXT NOT NULL DEFAULT '',
  access_token_ciphertext TEXT NOT NULL,
  app_secret_ciphertext TEXT NOT NULL DEFAULT '',
  verify_token TEXT NOT NULL,
  display_phone TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  last_error TEXT NOT NULL DEFAULT '',
  reminder_template_name TEXT NOT NULL DEFAULT 'recordatorio_turno',
  reminder_template_lang TEXT NOT NULL DEFAULT 'es_AR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_accounts TO authenticated;
GRANT ALL ON public.whatsapp_accounts TO service_role;
ALTER TABLE public.whatsapp_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_whatsapp_account ON public.whatsapp_accounts FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE TRIGGER trg_whatsapp_accounts_updated BEFORE UPDATE ON public.whatsapp_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.whatsapp_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  step TEXT NOT NULL DEFAULT 'menu',
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  history JSONB NOT NULL DEFAULT '[]'::jsonb,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '24 hours',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, phone)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_sessions TO authenticated;
GRANT ALL ON public.whatsapp_sessions TO service_role;
ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_whatsapp_sessions ON public.whatsapp_sessions FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE TRIGGER trg_whatsapp_sessions_updated BEFORE UPDATE ON public.whatsapp_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.whatsapp_processed_messages (
  message_id TEXT NOT NULL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.whatsapp_processed_messages TO service_role;
ALTER TABLE public.whatsapp_processed_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_only_wa_msgs ON public.whatsapp_processed_messages FOR ALL TO service_role
  USING (true) WITH CHECK (true);

ALTER TABLE public.appointments
  ADD COLUMN reminder_sent_at TIMESTAMPTZ,
  ADD COLUMN confirmed_at TIMESTAMPTZ;

CREATE INDEX idx_appointments_reminder ON public.appointments (start_at) WHERE reminder_sent_at IS NULL;