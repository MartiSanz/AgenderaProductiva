ALTER TABLE public.appointments ADD COLUMN calendar_event_id text NOT NULL DEFAULT '';

GRANT ALL ON public.appointments TO service_role;