-- Daily reading log: one row per day the user read. Drives the streak on the home widget.
create table if not exists public.reading_days (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.reading_days enable row level security;

create policy "user owns reading_days" on public.reading_days
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
