ALTER TABLE public.professional_config
ADD COLUMN IF NOT EXISTS non_working_days smallint[] NOT NULL DEFAULT '{}'::smallint[];