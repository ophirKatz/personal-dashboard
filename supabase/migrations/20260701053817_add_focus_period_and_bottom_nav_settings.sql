alter table public.user_settings
  add column if not exists default_focus_period text not null default 'week'
    check (default_focus_period in ('today', 'week')),
  add column if not exists bottom_nav_items jsonb not null default '["todos", "calendar", "files"]'::jsonb;
