CREATE TABLE public.app_user_connection_slots (
  user_id uuid NOT NULL,
  connector_id text NOT NULL,
  slot integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, connector_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_user_connection_slots TO service_role;
ALTER TABLE public.app_user_connection_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON public.app_user_connection_slots FOR ALL TO service_role USING (true) WITH CHECK (true);