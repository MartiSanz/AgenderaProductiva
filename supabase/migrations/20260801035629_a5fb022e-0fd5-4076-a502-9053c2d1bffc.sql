ALTER TABLE public.professional_config
  ADD COLUMN IF NOT EXISTS google_calendar_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS google_calendar_name text NOT NULL DEFAULT 'Turnos';