select cron.schedule(
  'fetch-weather-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://tjjvrqamitwtoslinrxy.supabase.co/functions/v1/fetch-weather',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
