-- Create event_reminders table for calendar event reminders
CREATE TABLE IF NOT EXISTS event_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reminder_days_before INT NOT NULL,
  reminder_type VARCHAR NOT NULL DEFAULT 'calendar_event',
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, reminder_days_before)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_event_reminders_user_created
  ON event_reminders(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_event_reminders_event_id
  ON event_reminders(event_id);

-- Add index to events table for efficient date querying
CREATE INDEX IF NOT EXISTS idx_events_user_date
  ON events(user_id, event_date);

-- Enable RLS on event_reminders table
ALTER TABLE event_reminders ENABLE ROW LEVEL SECURITY;

-- Create RLS policy: users can only see their own reminders
CREATE POLICY "Users can view their own event reminders"
  ON event_reminders
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create RLS policy: users can insert their own reminders
CREATE POLICY "Users can create their own event reminders"
  ON event_reminders
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create RLS policy: users can delete their own reminders
CREATE POLICY "Users can delete their own event reminders"
  ON event_reminders
  FOR DELETE
  USING (auth.uid() = user_id);
