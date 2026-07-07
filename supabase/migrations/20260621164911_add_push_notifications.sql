
-- Push subscriptions: one row per browser/device registration
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "Users can view own push subscriptions"
  on public.push_subscriptions for select
  using (auth.uid() = user_id);

create policy "Users can insert own push subscriptions"
  on public.push_subscriptions for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own push subscriptions"
  on public.push_subscriptions for delete
  using (auth.uid() = user_id);

-- Habit reminders: optional time-of-day notification
alter table public.habits
  add column reminder_enabled boolean not null default false,
  add column reminder_time time,
  add column last_notified_date date;

-- Reminders: track whether a push has already been sent for the current remind_at
alter table public.reminders
  add column notified_at timestamptz;
