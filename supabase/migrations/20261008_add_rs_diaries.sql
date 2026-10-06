-- RuneScape 3 achievement diaries: shared task catalogue (synced from the wiki) + per-character completion.
create table if not exists public.rs_diary_tasks (
  id uuid primary key default gen_random_uuid(),
  area text not null,
  tier text not null check (tier in ('Easy', 'Medium', 'Hard', 'Elite')),
  name text not null,
  position int not null default 0,
  updated_at timestamptz not null default now(),
  unique (area, tier, name)
);

create table if not exists public.rs_diary_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id uuid not null references public.rs_characters(id) on delete cascade,
  task_id uuid not null references public.rs_diary_tasks(id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique (character_id, task_id)
);

create index if not exists rs_diary_progress_character_idx on public.rs_diary_progress (character_id);

alter table public.rs_diary_tasks enable row level security;
alter table public.rs_diary_progress enable row level security;

create policy "authenticated read rs_diary_tasks" on public.rs_diary_tasks
  for select to authenticated using (true);
create policy "authenticated insert rs_diary_tasks" on public.rs_diary_tasks
  for insert to authenticated with check (true);
create policy "authenticated update rs_diary_tasks" on public.rs_diary_tasks
  for update to authenticated using (true) with check (true);

create policy "user owns rs_diary_progress" on public.rs_diary_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
