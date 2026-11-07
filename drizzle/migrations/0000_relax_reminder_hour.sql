ALTER TABLE public.professional_config DROP CONSTRAINT IF EXISTS reminder_hour_check;
ALTER TABLE public.professional_config DROP CONSTRAINT IF EXISTS professional_config_reminder_hour_check;
ALTER TABLE public.professional_config ADD CONSTRAINT professional_config_reminder_hour_check CHECK (reminder_hour BETWEEN 0 AND 23);