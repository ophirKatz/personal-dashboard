alter table public.user_settings
  add column auto_generate_focus_summaries_daily_today boolean not null default true,
  add column auto_generate_focus_summaries_daily_week boolean not null default true,
  add column auto_generate_focus_summaries_on_change_today boolean not null default true,
  add column auto_generate_focus_summaries_on_change_week boolean not null default true;

update public.user_settings set
  auto_generate_focus_summaries_daily_today = auto_generate_focus_summaries_daily,
  auto_generate_focus_summaries_daily_week = auto_generate_focus_summaries_daily,
  auto_generate_focus_summaries_on_change_today = auto_generate_focus_summaries_on_change,
  auto_generate_focus_summaries_on_change_week = auto_generate_focus_summaries_on_change;

alter table public.user_settings
  drop column auto_generate_focus_summaries_daily,
  drop column auto_generate_focus_summaries_on_change;

create or replace function public.notify_focus_refresh(p_user_id uuid, p_target_date date)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_today date := (now() at time zone 'Asia/Jerusalem')::date;
  v_tomorrow date := v_today + 1;
  v_week_end date := v_today + 6;
  v_cron_secret text;
  v_on_change_today boolean;
  v_on_change_week boolean;
begin
  if p_target_date is null then
    return;
  end if;

  select auto_generate_focus_summaries_on_change_today, auto_generate_focus_summaries_on_change_week
  into v_on_change_today, v_on_change_week
  from public.user_settings where user_id = p_user_id;

  select decrypted_secret into v_cron_secret from vault.decrypted_secrets where name = 'cron_secret';
  if v_cron_secret is null then
    return;
  end if;

  if p_target_date = v_tomorrow and coalesce(v_on_change_today, true) then
    perform net.http_post(
      url := 'https://tjjvrqamitwtoslinrxy.supabase.co/functions/v1/generate-focus-summary',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_cron_secret
      ),
      body := jsonb_build_object('user_id', p_user_id, 'period', 'today')
    );
  end if;

  if p_target_date between v_today and v_week_end and coalesce(v_on_change_week, true) then
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
$function$;
