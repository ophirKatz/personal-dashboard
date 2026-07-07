select cron.schedule(
  'send-rain-notification-daily',
  '0 4 * * *',
  $$
  select net.http_post(
    url := 'https://tjjvrqamitwtoslinrxy.supabase.co/functions/v1/send-rain-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
