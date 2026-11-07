ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS confirm_token text,
  ADD COLUMN IF NOT EXISTS confirm_token_expires_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS appointments_confirm_token_key
  ON public.appointments (confirm_token) WHERE confirm_token IS NOT NULL;