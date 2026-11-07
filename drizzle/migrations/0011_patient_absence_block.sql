ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS absence_reset_at timestamptz;

CREATE OR REPLACE FUNCTION public.block_patient_on_absences()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _reset timestamptz; _n int;
BEGIN
  IF NEW.attendance = 'absent_no_notice' AND OLD.attendance IS DISTINCT FROM NEW.attendance THEN
    SELECT absence_reset_at INTO _reset FROM public.patients WHERE id = NEW.patient_id;
    SELECT count(*) INTO _n FROM public.appointments
      WHERE patient_id = NEW.patient_id AND owner_id = NEW.owner_id
        AND attendance = 'absent_no_notice'
        AND (_reset IS NULL OR coalesce(attendance_marked_at, start_at) > _reset);
    IF _n >= 3 THEN
      UPDATE public.patients SET is_blocked = true WHERE id = NEW.patient_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_block_patient_on_absences ON public.appointments;
CREATE TRIGGER trg_block_patient_on_absences AFTER UPDATE OF attendance ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.block_patient_on_absences();