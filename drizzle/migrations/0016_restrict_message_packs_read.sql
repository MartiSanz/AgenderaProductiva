DROP POLICY IF EXISTS "packs readable" ON public.message_packs;
CREATE POLICY "active packs readable" ON public.message_packs FOR SELECT TO authenticated
USING (active = true OR private.has_role(auth.uid(), 'admin'));