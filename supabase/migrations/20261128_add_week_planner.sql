-- Week planner: reusable quick-event presets (climbing session, date night, ...) that the
-- planner turns into Google Calendar events, plus an email on friends so they can be invited.
--
-- days            weekdays the preset is pre-selected on each week, 0 = Sunday .. 6 = Saturday.
-- day_overrides   per-weekday exceptions to the default, keyed by weekday: {"2": {"time": "19:00", "duration": 90}}.
--                 Either field may be omitted to fall back to the default.
-- invitees        people invited to every event made from the preset: [{"email": "a@b.com", "name": "Alex"}].
-- Times are wall-clock in the app timezone (Asia/Jerusalem), like the rest of the app.
create table if not exists public.week_presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  emoji text not null default '📅',
  title text not null check (length(btrim(title)) between 1 and 200),
  default_time time not null default '18:00',
  default_duration_minutes int not null default 60 check (default_duration_minutes between 5 and 1440),
  days smallint[] not null default '{}' check (days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  day_overrides jsonb not null default '{}'::jsonb check (jsonb_typeof(day_overrides) = 'object'),
  invitees jsonb not null default '[]'::jsonb check (jsonb_typeof(invitees) = 'array' and jsonb_array_length(invitees) <= 50),
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists week_presets_user_position_idx on public.week_presets (user_id, position);

alter table public.week_presets enable row level security;

create policy "user owns week_presets" on public.week_presets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Where a friend's calendar invitations go.
alter table public.friends add column if not exists email text;
