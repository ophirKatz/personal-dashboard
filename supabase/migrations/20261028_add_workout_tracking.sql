-- Workout tracking + reminders: one settings row per user.
--
-- tracking_start_date is the first day a missed workout counts as owed. It is set by the
-- client (local date) when the row is first created, and moved to today by "Start fresh".
-- Debt itself is derived from workout_logs, so nothing accrues in a cron job.
--
-- reminder_times are wall-clock times in the app timezone (Asia/Jerusalem), so a reminder
-- set for 18:00 stays at 18:00 across daylight saving. last_reminder_slot ("YYYY-MM-DD HH:MM")
-- records the slot send-notifications last handled, so each slot fires once.
create table if not exists public.workout_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  tracking_start_date date not null,
  reminder_enabled boolean not null default false,
  reminder_times time[] not null default '{}' check (cardinality(reminder_times) <= 6),
  last_reminder_slot text,
  created_at timestamptz not null default now()
);

alter table public.workout_settings enable row level security;

create policy "user owns workout_settings" on public.workout_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
