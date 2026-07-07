alter table public.habits
  add column debt integer not null default 0,
  add column debt_checked_date date;

alter table public.habit_logs
  add column paid_debt boolean not null default false;

alter table public.todos
  add column source_event_id text;
