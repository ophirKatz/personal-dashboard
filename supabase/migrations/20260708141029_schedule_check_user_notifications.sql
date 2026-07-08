select cron.schedule(
  'check-user-notifications',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://tjjvrqamitwtoslinrxy.supabase.co/functions/v1/check-user-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
