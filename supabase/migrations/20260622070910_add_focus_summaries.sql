create table public.focus_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period text not null check (period in ('today', 'week')),
  summary text,
  status text not null default 'ready' check (status in ('ready', 'error')),
  error text,
  generated_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, period)
);

alter table public.focus_summaries enable row level security;

create policy "select own focus summaries"
  on public.focus_summaries for select
  using (auth.uid() = user_id);

-- Writes are done exclusively by the generate-focus-summary edge function via the
-- service role key (which bypasses RLS), same pattern as send-notifications writes
-- to reminders/todos/habits. No insert/update/delete policy is needed for end users.

create or replace function public.notify_focus_refresh(p_user_id uuid, p_target_date date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Jerusalem')::date;
  v_week_end date := v_today + 6;
  v_cron_secret text;
begin
  if p_target_date is null then
    return;
  end if;

  select decrypted_secret into v_cron_secret from vault.decrypted_secrets where name = 'cron_secret';
  if v_cron_secret is null then
    return;
  end if;

  if p_target_date = v_today then
    perform net.http_post(
      url := 'https://tjjvrqamitwtoslinrxy.supabase.co/functions/v1/generate-focus-summary',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_cron_secret
      ),
      body := jsonb_build_object('user_id', p_user_id, 'period', 'today')
    );
  end if;

  if p_target_date between v_today and v_week_end then
    perform net.http_post(
      url := 'https://tjjvrqamitwtoslinrxy.supabase.co/functions/v1/generate-focus-summary',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_cron_secret
      ),
      body := jsonb_build_object('user_id', p_user_id, 'period', 'week')
    );
  end if;
end;
$$;

create or replace function public.todos_focus_refresh_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.notify_focus_refresh(NEW.user_id, NEW.due_date);
  return NEW;
end;
$$;

create trigger todos_focus_refresh
after insert or update of due_date on public.todos
for each row execute function public.todos_focus_refresh_trigger();

create or replace function public.events_focus_refresh_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.notify_focus_refresh(NEW.user_id, NEW.event_date);
  return NEW;
end;
$$;

create trigger events_focus_refresh
after insert or update of event_date on public.events
for each row execute function public.events_focus_refresh_trigger();

-- 7am Asia/Jerusalem ≈ 4am UTC during IDT (UTC+3, roughly late Mar-late Oct).
-- During IST (UTC+2, winter) this fires at 6am local instead of 7am — pg_cron has
-- no timezone-aware scheduling, so a ~1hr seasonal drift is an accepted trade-off
-- for a personal app rather than maintaining two seasonal cron jobs.
select cron.schedule(
  'generate-daily-focus-summaries',
  '0 4 * * *',
  $$
  select net.http_post(
    url := 'https://tjjvrqamitwtoslinrxy.supabase.co/functions/v1/generate-focus-summary',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
