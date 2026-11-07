CREATE TABLE public.schedule_date_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT schedule_date_blocks_range CHECK (end_date >= start_date AND end_time > start_time)
);
CREATE INDEX schedule_date_blocks_owner_idx ON public.schedule_date_blocks(owner_id, start_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_date_blocks TO authenticated;
GRANT ALL ON public.schedule_date_blocks TO service_role;
ALTER TABLE public.schedule_date_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their date blocks" ON public.schedule_date_blocks
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);