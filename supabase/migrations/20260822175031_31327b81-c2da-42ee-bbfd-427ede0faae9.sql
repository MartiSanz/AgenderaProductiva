CREATE TABLE public.access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL DEFAULT '',
  profession text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  weekly_volume text NOT NULL DEFAULT '',
  goal text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  admin_notes text NOT NULL DEFAULT '',
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT access_requests_status_check CHECK (status IN ('pending','approved','rejected'))
);

CREATE UNIQUE INDEX access_requests_email_key ON public.access_requests (lower(email));

GRANT INSERT ON public.access_requests TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.access_requests TO authenticated;
GRANT ALL ON public.access_requests TO service_role;

ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY access_requests_public_insert ON public.access_requests
  FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'pending' AND reviewed_at IS NULL AND invited_at IS NULL);

CREATE POLICY access_requests_own_select ON public.access_requests
  FOR SELECT TO authenticated
  USING (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')) OR private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY access_requests_admin_write ON public.access_requests
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_access_requests_updated
  BEFORE UPDATE ON public.access_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Existing professionals keep their access: they are recorded as already approved.
INSERT INTO public.access_requests (full_name, email, status, reviewed_at, invited_at, admin_notes)
SELECT coalesce(u.raw_user_meta_data ->> 'full_name', u.email), u.email, 'approved', now(), now(), 'Cuenta existente antes del alta por invitación'
FROM auth.users u
WHERE u.email IS NOT NULL
ON CONFLICT DO NOTHING;