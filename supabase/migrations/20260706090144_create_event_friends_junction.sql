
create table public.event_friends (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  friend_id uuid not null references public.friends(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (event_id, friend_id)
);

alter table public.event_friends enable row level security;

create policy "Users can view their own event_friends"
  on public.event_friends for select
  using (auth.uid() = user_id);

create policy "Users can insert their own event_friends"
  on public.event_friends for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own event_friends"
  on public.event_friends for delete
  using (auth.uid() = user_id);
