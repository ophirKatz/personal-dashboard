-- Add soft delete support to google_accounts table
-- This prevents data loss when disconnecting and reconnecting accounts
ALTER TABLE google_accounts ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create an index on (user_id, deleted_at) for efficient filtering of active accounts
CREATE INDEX idx_google_accounts_user_id_deleted_at ON google_accounts(user_id, deleted_at);
