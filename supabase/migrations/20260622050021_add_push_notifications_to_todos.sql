alter table public.todos
  add column reminder_enabled boolean not null default false,
  add column remind_at timestamptz null,
  add column notified_at timestamptz null;
