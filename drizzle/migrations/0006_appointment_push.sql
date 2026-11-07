alter table public.push_subscriptions add column if not exists last_title text, add column if not exists last_body text, add column if not exists last_url text;

create or replace function public.notify_new_appointment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and auth.uid() = new.owner_id then
    return new;
  end if;
  perform net.http_post(
    url := 'https://project--fc5d1a33-4a53-4525-bc6a-b40c181f46e1-dev.lovable.app/api/public/hooks/appointment-push',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select value from public.internal_settings where key='cron_secret')),
    body := jsonb_build_object('appointment_id', new.id));
  return new;
exception when others then
  return new;
end $$;
revoke execute on function public.notify_new_appointment() from public, anon, authenticated;

create trigger appointment_push after insert on public.appointments
for each row execute function public.notify_new_appointment();