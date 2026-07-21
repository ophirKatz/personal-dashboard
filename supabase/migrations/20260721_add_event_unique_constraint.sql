-- Add unique constraint for Google Calendar event deduplication
-- This ensures each Google event is only synced once per account per user
-- The constraint is necessary for the upsert operation in fetch-google-calendar

-- Remove older duplicates if they exist (keep only the most recently created row)
-- This is safe because Google Calendar events are immutable and we refetch them anyway
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY user_id, google_account_id, google_event_id
    ORDER BY created_at DESC
  ) AS rn
  FROM events
  WHERE source = 'google'
    AND user_id IS NOT NULL
    AND google_account_id IS NOT NULL
    AND google_event_id IS NOT NULL
)
DELETE FROM events
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Add the unique constraint
ALTER TABLE events
ADD CONSTRAINT events_user_id_google_account_id_google_event_id_key
UNIQUE (user_id, google_account_id, google_event_id);

-- Create index for efficient filtering during sync
CREATE INDEX IF NOT EXISTS idx_events_google_sync
ON events(user_id, google_account_id, google_event_id)
WHERE source = 'google';
