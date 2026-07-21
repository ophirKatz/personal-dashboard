-- Add unique constraint for Google Calendar event deduplication
-- This ensures each Google event is only synced once per account per user
-- The constraint is necessary for the upsert operation in fetch-google-calendar

-- Remove older duplicates if they exist (keep only the latest occurrence)
-- This is safe because Google Calendar events are immutable and we refetch them anyway
DELETE FROM events e1
WHERE e1.source = 'google'
  AND e1.user_id IS NOT NULL
  AND e1.google_account_id IS NOT NULL
  AND e1.google_event_id IS NOT NULL
  AND e1.id < (
    SELECT MAX(e2.id)
    FROM events e2
    WHERE e2.source = 'google'
      AND e2.user_id = e1.user_id
      AND e2.google_account_id = e1.google_account_id
      AND e2.google_event_id = e1.google_event_id
  );

-- Add the unique constraint
ALTER TABLE events
ADD CONSTRAINT events_user_id_google_account_id_google_event_id_key
UNIQUE (user_id, google_account_id, google_event_id);

-- Create index for efficient filtering during sync
CREATE INDEX IF NOT EXISTS idx_events_google_sync
ON events(user_id, google_account_id, google_event_id)
WHERE source = 'google';
