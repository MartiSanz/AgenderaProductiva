CREATE TABLE public.locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text NOT NULL DEFAULT '',
  maps_url text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.locations TO authenticated;
GRANT ALL ON public.locations TO service_role;

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY own_locations ON public.locations FOR ALL TO authenticated
USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE TRIGGER trg_locations_updated BEFORE UPDATE ON public.locations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_locations_owner ON public.locations(owner_id);

ALTER TABLE public.weekly_schedule
  ADD COLUMN location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL;

INSERT INTO public.locations (owner_id, name, address, maps_url)
SELECT owner_id, 'Consultorio principal', address, maps_url
FROM public.professional_config
WHERE btrim(address) <> '';

UPDATE public.weekly_schedule ws
SET location_id = l.id
FROM public.locations l
WHERE l.owner_id = ws.owner_id AND l.name = 'Consultorio principal';