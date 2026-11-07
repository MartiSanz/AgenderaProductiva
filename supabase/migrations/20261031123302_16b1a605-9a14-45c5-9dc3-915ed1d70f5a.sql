create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  endpoint text not null unique,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
grant select, insert, delete on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;
create policy "own push subs select" on public.push_subscriptions for select to authenticated using (auth.uid() = user_id);
create policy "own push subs insert" on public.push_subscriptions for insert to authenticated with check (auth.uid() = user_id);
create policy "own push subs delete" on public.push_subscriptions for delete to authenticated using (auth.uid() = user_id);

create or replace function public.notify_new_access_request()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := 'https://project--fc5d1a33-4a53-4525-bc6a-b40c181f46e1-dev.lovable.app/api/public/hooks/access-request-push',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select value from public.internal_settings where key='cron_secret')),
    body := '{}'::jsonb);
  return new;
exception when others then
  return new;
end $$;
revoke execute on function public.notify_new_access_request() from public, anon, authenticated;

create trigger access_request_push after insert on public.access_requests
for each row execute function public.notify_new_access_request();