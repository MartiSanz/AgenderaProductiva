CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _plan text;
BEGIN
  INSERT INTO public.professional_config (owner_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, 'Profesional'))
  ON CONFLICT (owner_id) DO NOTHING;

  SELECT requested_plan INTO _plan FROM public.access_requests
   WHERE lower(email) = lower(NEW.email) ORDER BY created_at DESC LIMIT 1;

  INSERT INTO public.account_plans (user_id, plan)
  VALUES (NEW.id, COALESCE(_plan, 'basic'))
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$function$;