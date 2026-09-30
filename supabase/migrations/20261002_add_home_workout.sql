-- Home workout: exercises, presets (templates), and logged workout instances
create table if not exists public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  icon text not null default 'dumbbell',
  builtin_key text,
  created_at timestamptz not null default now()
);
create unique index if not exists workout_exercises_user_builtin_idx
  on public.workout_exercises (user_id, builtin_key) where builtin_key is not null;

create table if not exists public.workout_presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists workout_presets_one_default_idx
  on public.workout_presets (user_id) where is_default;

create table if not exists public.workout_preset_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  preset_id uuid not null references public.workout_presets(id) on delete cascade,
  exercise_id uuid not null references public.workout_exercises(id) on delete cascade,
  sets int not null default 3 check (sets > 0),
  reps int not null default 10 check (reps > 0),
  position int not null default 0
);
create index if not exists workout_preset_exercises_preset_idx on public.workout_preset_exercises (preset_id);

create table if not exists public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  preset_id uuid references public.workout_presets(id) on delete set null,
  preset_name text,
  log_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists workout_logs_user_date_idx on public.workout_logs (user_id, log_date desc);

-- exercise name/icon are snapshotted so history survives exercise deletion
create table if not exists public.workout_log_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_id uuid not null references public.workout_logs(id) on delete cascade,
  exercise_id uuid references public.workout_exercises(id) on delete set null,
  exercise_name text not null,
  icon text not null default 'dumbbell',
  sets int not null default 1 check (sets >= 0),
  reps int not null default 1 check (reps >= 0),
  position int not null default 0
);
create index if not exists workout_log_exercises_log_idx on public.workout_log_exercises (log_id);

alter table public.workout_exercises enable row level security;
alter table public.workout_presets enable row level security;
alter table public.workout_preset_exercises enable row level security;
alter table public.workout_logs enable row level security;
alter table public.workout_log_exercises enable row level security;

create policy "user owns workout_exercises" on public.workout_exercises
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user owns workout_presets" on public.workout_presets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user owns workout_preset_exercises" on public.workout_preset_exercises
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user owns workout_logs" on public.workout_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user owns workout_log_exercises" on public.workout_log_exercises
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
