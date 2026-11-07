DROP INDEX IF EXISTS public.patients_owner_dni_unique;
CREATE INDEX IF NOT EXISTS patients_owner_phone_idx ON public.patients (owner_id, phone);