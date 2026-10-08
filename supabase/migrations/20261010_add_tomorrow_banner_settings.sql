-- "Tomorrow preview" banner on the Home "Today" widget. From
-- tomorrow_banner_start (Israel time, HH:MM) it summarizes tomorrow's events
-- and tasks that fall before tomorrow_banner_end. dismissed_at records when the
-- user last dismissed it; the banner stays hidden for the rest of that
-- Israel-time day.
alter table public.user_settings
  add column if not exists tomorrow_banner_start text not null default '21:00',
  add column if not exists tomorrow_banner_end text not null default '12:00',
  add column if not exists tomorrow_banner_dismissed_at timestamptz;
