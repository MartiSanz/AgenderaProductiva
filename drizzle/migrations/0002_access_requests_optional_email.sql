DROP INDEX IF EXISTS public.access_requests_email_key;
CREATE UNIQUE INDEX access_requests_email_key ON public.access_requests (lower(email)) WHERE email <> '';