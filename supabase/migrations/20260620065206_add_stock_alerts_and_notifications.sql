create table public.stock_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  symbol text not null,
  target_price numeric not null default 30,
  triggered_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, symbol)
);

alter table public.stock_alerts enable row level security;

create policy "user owns stock_alerts" on public.stock_alerts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  type text not null default 'info',
  title text not null,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

create policy "user owns notifications" on public.notifications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
