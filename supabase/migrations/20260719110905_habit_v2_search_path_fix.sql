-- Fix function_search_path_mutable advisory lint on the habit v2 functions
-- by pinning search_path to empty (all internal references are already
-- schema-qualified with public.).

create or replace function public.israel_today()
returns date
language sql
stable
set search_path = ''
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
set search_path = ''
as $$
  select case p_frequency
    when 'daily' then 1
    when 'weekly' then greatest(1, 7 / greatest(p_times_per_week, 1))
    when 'every_n_days' then greatest(1, p_interval_days)
  end
$$;

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
set search_path = ''
as $$
  select case
    when (p_created_at at time zone 'Asia/Jerusalem')::date > p_as_of then 0
    else
      ((p_as_of - (p_created_at at time zone 'Asia/Jerusalem')::date)
        / public.habit_period_length_days(p_frequency, p_times_per_week, p_interval_days)) + 1
  end
$$;

create or replace function public.habit_owed_count(p_habit_id uuid)
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select greatest(
    0,
    public.habit_periods_elapsed(h.created_at, h.frequency, h.times_per_week, h.interval_days)
      - (select count(*) from public.habit_logs l where l.habit_id = h.id)
  )
  from public.habits h
  where h.id = p_habit_id
$$;

create or replace function public.habit_streak(p_habit_id uuid)
returns integer
language plpgsql
stable
security invoker
set search_path = ''
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

create or replace function public.toggle_habit_completion(p_habit_id uuid)
returns table (action text, log_id uuid, owed_count integer)
language plpgsql
security invoker
set search_path = ''
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
