DO $$ BEGIN
  CREATE TYPE public.attendance_status AS ENUM ('pending','attended','absent_notified','absent_no_notice');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS attendance attendance_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS attendance_marked_at timestamptz;

CREATE OR REPLACE FUNCTION public.purge_old_appointments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.appointments
  WHERE end_at < now() - interval '7 days';

  DELETE FROM public.patients p
  WHERE NOT EXISTS (
    SELECT 1 FROM public.appointments a WHERE a.patient_id = p.id
  )
  AND p.created_at < now() - interval '7 days';
END;
$$;