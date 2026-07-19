-- Habit tracking v2 (event-sourced, derived state) behind a feature flag.
-- Purely additive except for dropping the stale unique constraint on
-- habit_logs (see below) — the existing debt-counter system (habits.debt,
-- habits.debt_checked_date, habit_logs.paid_debt, the accrue-habit-debt
-- cron/Edge Function) is left fully intact and continues to run.

-- 1a. Feature flag (singleton row, personal single-user app so no user_id
-- scoping). Defaults to false so applying this migration changes nothing
-- observable until explicitly flipped.
create table public.app_settings (
  id boolean primary key default true,
  habits_v2_enabled boolean not null default false,
  constraint app_settings_singleton check (id)
);

insert into public.app_settings (id) values (true);

alter table public.app_settings enable row level security;

create policy "authenticated read app_settings" on public.app_settings
  for select using (auth.role() = 'authenticated');

create policy "authenticated update app_settings" on public.app_settings
  for update using (auth.role() = 'authenticated');

grant select, update on public.app_settings to authenticated;

-- 1b. habits: add interval_days for the new "every N days" frequency mode,
-- widen the frequency CHECK to allow it. debt/debt_checked_date are left
-- untouched — v1 still reads/writes them.
alter table public.habits add column interval_days integer;

alter table public.habits drop constraint habits_frequency_check;
alter table public.habits add constraint habits_frequency_check
  check (frequency in ('daily', 'weekly', 'every_n_days'));

alter table public.habits add constraint habits_frequency_fields_check
  check (
    (frequency = 'daily' and times_per_week is null and interval_days is null)
    or (frequency = 'weekly' and times_per_week between 1 and 7 and interval_days is null)
    or (frequency = 'every_n_days' and interval_days >= 2 and times_per_week is null)
  );

-- 1c. habit_logs: drop the unique(habit_id, logged_date) constraint. It's
-- currently live and enforced, and it silently breaks v1's own multi-tap
-- catch-up flow today (2nd same-day insert fails; executeHabitTap doesn't
-- check the error). Dropping it is a bug fix for v1 and a hard requirement
-- for v2's tally model, which needs multiple same-day log rows to be
-- valid when catching up several owed periods in one sitting.
alter table public.habit_logs drop constraint habit_logs_habit_id_logged_date_key;

create index habit_logs_habit_id_logged_date_idx
  on public.habit_logs (habit_id, logged_date);

-- 1d. Core v2 functions — single source of truth for period/tally/streak
-- math, all timezone-aware (Asia/Jerusalem, matching the rest of the app).

create or replace function public.israel_today()
returns date
language sql
stable
as $$
  select (now() at time zone 'Asia/Jerusalem')::date
$$;

create or replace function public.habit_period_length_days(
  p_frequency text,
  p_times_per_week integer,
  p_interval_days integer
)
returns integer
language sql
immutable
as $$
  select case p_frequency
    when 'daily' then 1
    when 'weekly' then greatest(1, 7 / greatest(p_times_per_week, 1))
    when 'every_n_days' then greatest(1, p_interval_days)
  end
$$;

-- Number of periods elapsed since habit creation, inclusive of the
-- current (possibly-unfinished) one.
create or replace function public.habit_periods_elapsed(
  p_created_at timestamptz,
  p_frequency text,
  p_times_per_week integer,
  p_interval_days integer,
  p_as_of date default public.israel_today()
)
returns integer
language sql
stable
as $$
  select case
    when (p_created_at at time zone 'Asia/Jerusalem')::date > p_as_of then 0
    else
      ((p_as_of - (p_created_at at time zone 'Asia/Jerusalem')::date)
        / public.habit_period_length_days(p_frequency, p_times_per_week, p_interval_days)) + 1
  end
$$;

-- The tally formula: periods elapsed minus total logs ever, floored at 0.
-- Operates over the entire real habit_logs history for the habit,
-- including rows written while v1 was the active implementation — a
-- completion is a completion regardless of which mode logged it.
create or replace function public.habit_owed_count(p_habit_id uuid)
returns integer
language sql
stable
security invoker
as $$
  select greatest(
    0,
    public.habit_periods_elapsed(h.created_at, h.frequency, h.times_per_week, h.interval_days)
      - (select count(*) from public.habit_logs l where l.habit_id = h.id)
  )
  from public.habits h
  where h.id = p_habit_id
$$;

-- Walk backward period-by-period from the most recent period, counting
-- consecutive periods with >=1 log dated inside that period's window.
-- The current (most recent) period not having a log yet does not break
-- the streak -- only a fully elapsed period with zero logs does.
create or replace function public.habit_streak(p_habit_id uuid)
returns integer
language plpgsql
stable
security invoker
as $$
declare
  h record;
  period_len integer;
  created_date date;
  today date := public.israel_today();
  total_periods integer;
  idx integer;
  window_start date;
  window_end date;
  has_log boolean;
  streak integer := 0;
  checking_current boolean := true;
begin
  select frequency, times_per_week, interval_days, created_at into h
  from public.habits where id = p_habit_id;

  if not found then
    return 0;
  end if;

  created_date := (h.created_at at time zone 'Asia/Jerusalem')::date;
  if created_date > today then
    return 0;
  end if;

  period_len := public.habit_period_length_days(h.frequency, h.times_per_week, h.interval_days);
  total_periods := ((today - created_date) / period_len) + 1;

  if total_periods <= 0 then
    return 0;
  end if;

  for idx in reverse (total_periods - 1)..0 loop
    window_start := created_date + (idx * period_len);
    window_end := window_start + period_len - 1;

    select exists(
      select 1 from public.habit_logs
      where habit_id = p_habit_id
        and logged_date between window_start and least(window_end, today)
    ) into has_log;

    if has_log then
      streak := streak + 1;
    elsif checking_current then
      null;
    else
      exit;
    end if;

    checking_current := false;
  end loop;

  return streak;
end;
$$;

-- 1e. habit_status view -- v2's read path. security_invoker so the
-- underlying RLS on habits still applies transparently.
create or replace view public.habit_status
with (security_invoker = true) as
select
  h.*,
  public.habit_owed_count(h.id) as owed_count,
  public.habit_owed_count(h.id) > 0 as is_due_today,
  public.habit_streak(h.id) as streak,
  exists(
    select 1 from public.habit_logs l
    where l.habit_id = h.id and l.logged_date = public.israel_today()
  ) as logged_today,
  (
    select count(*) from public.habit_logs l
    where l.habit_id = h.id and l.logged_date = public.israel_today()
  ) as logged_today_count
from public.habits h;

grant select on public.habit_status to authenticated;

-- 1f. toggle_habit_completion RPC -- v2's write path. security invoker
-- with an explicit ownership check; the read-decide-write happens in one
-- atomic function call, eliminating the client-side read-modify-write
-- race that the debt counter relied on.
create or replace function public.toggle_habit_completion(p_habit_id uuid)
returns table (action text, log_id uuid, owed_count integer)
language plpgsql
security invoker
as $$
declare
  v_user_id uuid := auth.uid();
  v_owed integer;
  v_most_recent_today uuid;
  v_new_log_id uuid;
begin
  if not exists (select 1 from public.habits where id = p_habit_id and user_id = v_user_id) then
    raise exception 'habit not found or not owned by caller';
  end if;

  v_owed := public.habit_owed_count(p_habit_id);

  if v_owed > 0 then
    insert into public.habit_logs (habit_id, user_id, logged_date)
    values (p_habit_id, v_user_id, public.israel_today())
    returning id into v_new_log_id;

    return query select 'logged'::text, v_new_log_id, public.habit_owed_count(p_habit_id);
  else
    select id into v_most_recent_today
    from public.habit_logs
    where habit_id = p_habit_id and logged_date = public.israel_today()
    order by created_at desc
    limit 1;

    if v_most_recent_today is null then
      return query select 'noop'::text, null::uuid, 0;
    else
      delete from public.habit_logs where id = v_most_recent_today;
      return query select 'undone'::text, v_most_recent_today, public.habit_owed_count(p_habit_id);
    end if;
  end if;
end;
$$;

grant execute on function public.toggle_habit_completion(uuid) to authenticated;
