ALTER TABLE public.professional_config
  ADD COLUMN IF NOT EXISTS calendar_sync_mode text NOT NULL DEFAULT 'app_only',
  ADD COLUMN IF NOT EXISTS calendar_sync_interval_minutes smallint NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS calendar_last_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS calendar_last_sync_summary jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.professional_config
  DROP CONSTRAINT IF EXISTS professional_config_calendar_sync_mode_check;
ALTER TABLE public.professional_config
  ADD CONSTRAINT professional_config_calendar_sync_mode_check
  CHECK (calendar_sync_mode IN ('app_only', 'two_way'));

ALTER TABLE public.professional_config
  DROP CONSTRAINT IF EXISTS professional_config_calendar_sync_interval_check;
ALTER TABLE public.professional_config
  ADD CONSTRAINT professional_config_calendar_sync_interval_check
  CHECK (calendar_sync_interval_minutes IN (5, 10, 15, 30, 60));

CREATE INDEX IF NOT EXISTS appointments_calendar_event_id_idx
  ON public.appointments (calendar_event_id)
  WHERE calendar_event_id <> '';