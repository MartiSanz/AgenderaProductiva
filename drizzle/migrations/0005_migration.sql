create table public.internal_settings (
  key text primary key,
  value text not null,
  created_at timestamptz not null default now()
);
revoke all on public.internal_settings from public, anon, authenticated;
grant all on public.internal_settings to service_role;
alter table public.internal_settings enable row level security;
insert into public.internal_settings (key, value)
values ('cron_secret', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (key) do nothing;