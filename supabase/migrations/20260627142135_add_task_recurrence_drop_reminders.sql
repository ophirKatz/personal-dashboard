alter table public.todos
  add column recurrence_interval integer,
  add column recurrence_unit text;

alter table public.todos
  add constraint todos_recurrence_unit_check
    check (recurrence_unit is null or recurrence_unit in ('day', 'week', 'month'));

alter table public.todos
  add constraint todos_recurrence_interval_check
    check (recurrence_interval is null or recurrence_interval > 0);

alter table public.todos
  add constraint todos_recurrence_pair_check
    check ((recurrence_interval is null) = (recurrence_unit is null));

drop table public.reminders;
