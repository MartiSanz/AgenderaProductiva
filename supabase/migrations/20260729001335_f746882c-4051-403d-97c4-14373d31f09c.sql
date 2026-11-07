ALTER TABLE public.professional_config
ADD COLUMN IF NOT EXISTS max_active_appointments_per_patient smallint NOT NULL DEFAULT 1;