ALTER TABLE public.patients DROP CONSTRAINT IF EXISTS patients_owner_id_phone_key;
ALTER TABLE public.patients ADD CONSTRAINT patients_owner_id_phone_dni_key UNIQUE (owner_id, phone, dni);