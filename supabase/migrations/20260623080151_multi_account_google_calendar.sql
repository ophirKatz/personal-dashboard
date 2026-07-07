
-- Rename single-row token table into a multi-row "google_accounts" table.
ALTER TABLE google_oauth_tokens RENAME TO google_accounts;
ALTER POLICY google_calendar_tokens_owner ON google_accounts RENAME TO google_accounts_owner;

ALTER TABLE google_accounts ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE google_accounts ADD COLUMN email text;
ALTER TABLE google_accounts ADD COLUMN color text;

UPDATE google_accounts ga SET email = u.email FROM auth.users u WHERE u.id = ga.user_id AND ga.email IS NULL;
UPDATE google_accounts SET color = '#3b82f6' WHERE color IS NULL;

ALTER TABLE google_accounts ALTER COLUMN email SET NOT NULL;
ALTER TABLE google_accounts ALTER COLUMN color SET NOT NULL;
ALTER TABLE google_accounts ALTER COLUMN color SET DEFAULT '#3b82f6';

ALTER TABLE google_accounts DROP CONSTRAINT google_calendar_tokens_pkey;
ALTER TABLE google_accounts ADD PRIMARY KEY (id);
ALTER TABLE google_accounts ADD CONSTRAINT google_accounts_user_email_unique UNIQUE (user_id, email);

-- Short-lived nonce table for the "connect another account" OAuth round trip
-- (the callback has no Supabase session, so it can't be auth.uid()-scoped).
CREATE TABLE google_oauth_states (
  state uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE google_oauth_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY google_oauth_states_owner ON google_oauth_states
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Tag synced calendar events with which connected account they came from.
ALTER TABLE events ADD COLUMN google_account_id uuid REFERENCES google_accounts(id) ON DELETE CASCADE;
UPDATE events e SET google_account_id = ga.id
  FROM google_accounts ga WHERE e.user_id = ga.user_id AND e.source = 'google' AND e.google_account_id IS NULL;

DROP INDEX events_user_google_event_unique;
CREATE UNIQUE INDEX events_user_account_event_unique ON events (user_id, google_account_id, google_event_id);
