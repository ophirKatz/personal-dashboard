create table public.todo_friends (
  id uuid primary key default gen_random_uuid(),
  todo_id uuid not null references public.todos(id) on delete cascade,
  friend_id uuid not null references public.friends(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (todo_id, friend_id)
);

alter table public.todo_friends enable row level security;

create policy "Users can view their own todo_friends"
  on public.todo_friends for select
  using (auth.uid() = user_id);

create policy "Users can insert their own todo_friends"
  on public.todo_friends for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own todo_friends"
  on public.todo_friends for delete
  using (auth.uid() = user_id);
