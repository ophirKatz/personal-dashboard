
create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret(
  'fa6e9b50a5ce3a434177549e919a2dc9e53f3600e1420b2ee13e2e72361249db',
  'cron_secret',
  'Shared secret for authenticating pg_cron calls to the Vercel send-notifications endpoint'
);

select cron.schedule(
  'send-due-notifications',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://personal-dashboard-azure-omega.vercel.app/api/send-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
