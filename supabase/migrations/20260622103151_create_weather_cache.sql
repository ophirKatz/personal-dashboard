create table public.weather_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  latitude numeric not null,
  longitude numeric not null,
  temperature numeric,
  feels_like numeric,
  weather_code integer,
  condition text,
  is_day boolean,
  humidity numeric,
  wind_speed numeric,
  status text not null default 'ready' check (status = any (array['ready', 'error'])),
  error text,
  fetched_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.weather_cache enable row level security;

create policy "select own weather cache" on public.weather_cache
  for select using (auth.uid() = user_id);
