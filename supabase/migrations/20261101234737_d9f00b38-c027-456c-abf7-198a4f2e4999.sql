CREATE TABLE public.message_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quantity integer NOT NULL,
  price_ars numeric NOT NULL,
  validity_days integer NOT NULL DEFAULT 90,
  active boolean NOT NULL DEFAULT true,
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.message_packs TO authenticated;
GRANT ALL ON public.message_packs TO service_role;
ALTER TABLE public.message_packs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "packs readable" ON public.message_packs FOR SELECT TO authenticated USING (true);
INSERT INTO public.message_packs (quantity, price_ars, sort_order) VALUES (25,2490,1),(50,4490,2),(75,6490,3),(100,8490,4);

CREATE TABLE public.professional_message_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  pack_id uuid REFERENCES public.message_packs(id),
  quantity integer NOT NULL,
  remaining integer NOT NULL,
  price_ars numeric NOT NULL,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  payment_status text NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.professional_message_packs(owner_id, expires_at);
GRANT SELECT ON public.professional_message_packs TO authenticated;
GRANT ALL ON public.professional_message_packs TO service_role;
ALTER TABLE public.professional_message_packs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own packs readable" ON public.professional_message_packs FOR SELECT TO authenticated USING (owner_id = auth.uid());

CREATE OR REPLACE FUNCTION public.consume_reminder_credit(_owner uuid, _monthly integer)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE used integer; pid uuid; mstart timestamptz;
BEGIN
  mstart := (date_trunc('month', now() AT TIME ZONE 'America/Argentina/Buenos_Aires')) AT TIME ZONE 'America/Argentina/Buenos_Aires';
  PERFORM pg_advisory_xact_lock(hashtext(_owner::text));
  SELECT count(*) INTO used FROM reminder_attempts WHERE owner_id = _owner AND created_at >= mstart AND status <> 'failed';
  IF used < _monthly THEN RETURN 'plan'; END IF;
  SELECT id INTO pid FROM professional_message_packs
   WHERE owner_id = _owner AND remaining > 0 AND cancelled_at IS NULL AND expires_at > now()
   ORDER BY expires_at ASC LIMIT 1 FOR UPDATE;
  IF pid IS NULL THEN RETURN 'none'; END IF;
  UPDATE professional_message_packs SET remaining = remaining - 1 WHERE id = pid;
  RETURN pid::text;
END $$;

CREATE OR REPLACE FUNCTION public.refund_reminder_credit(_pack uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE professional_message_packs SET remaining = LEAST(quantity, remaining + 1) WHERE id = _pack;
$$;
REVOKE ALL ON FUNCTION public.consume_reminder_credit(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refund_reminder_credit(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_reminder_credit(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_reminder_credit(uuid) TO service_role;