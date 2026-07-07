create table public.friends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  notes text,
  avatar_url text,
  goal_count integer not null default 1,
  goal_unit text not null default 'month' check (goal_unit in ('day', 'week', 'month')),
  reminder_enabled boolean not null default true,
  last_notified_date date,
  reminder_notified_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.friend_interactions (
  id uuid primary key default gen_random_uuid(),
  friend_id uuid not null references public.friends(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  interaction_date date not null,
  note text,
  created_at timestamptz not null default now()
);

create index friend_interactions_friend_id_idx on public.friend_interactions(friend_id);

alter table public.friends enable row level security;
alter table public.friend_interactions enable row level security;

create policy "user owns friends" on public.friends for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "user owns friend_interactions" on public.friend_interactions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit)
values ('avatars', 'avatars', true, 5242880);

create policy "user owns avatar files" on storage.objects for all
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
