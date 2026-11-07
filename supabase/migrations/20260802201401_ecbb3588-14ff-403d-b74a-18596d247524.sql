REVOKE ALL ON FUNCTION public.purge_old_appointments() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_old_appointments() TO service_role;