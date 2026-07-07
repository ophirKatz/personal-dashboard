create table public.client_errors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  message text not null,
  stack text,
  url text,
  created_at timestamptz not null default now()
);

alter table public.client_errors enable row level security;

create policy "user owns client_errors" on public.client_errors
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
