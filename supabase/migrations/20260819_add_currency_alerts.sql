create table if not exists public.currency_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  from_currency text not null,
  to_currency text not null,
  target_rate numeric not null default 1,
  direction text not null default 'above' check (direction in ('above', 'below')),
  triggered_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, from_currency, to_currency)
);

alter table public.currency_alerts enable row level security;

create policy "user owns currency_alerts"
  on public.currency_alerts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
