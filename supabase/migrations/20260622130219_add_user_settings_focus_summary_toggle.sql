create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  auto_generate_focus_summaries boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

create policy "Users can view own settings" on public.user_settings
  for select using (auth.uid() = user_id);

create policy "Users can insert own settings" on public.user_settings
  for insert with check (auth.uid() = user_id);

create policy "Users can update own settings" on public.user_settings
  for update using (auth.uid() = user_id);

create or replace function public.notify_focus_refresh(p_user_id uuid, p_target_date date)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_today date := (now() at time zone 'Asia/Jerusalem')::date;
  v_week_end date := v_today + 6;
  v_cron_secret text;
  v_auto_generate boolean;
begin
  if p_target_date is null then
    return;
  end if;

  select auto_generate_focus_summaries into v_auto_generate
  from public.user_settings where user_id = p_user_id;

  if v_auto_generate is false then
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
$function$;
