ALTER TABLE public.professional_config
  ADD COLUMN IF NOT EXISTS booking_access_mode text NOT NULL DEFAULT 'open';

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS is_allowed boolean NOT NULL DEFAULT false;

UPDATE public.patients SET is_allowed = true WHERE is_allowed = false;