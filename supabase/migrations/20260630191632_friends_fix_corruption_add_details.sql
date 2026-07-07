
-- Reverse data corruption from the 'friends_goal_interval_model' migration.
-- That migration incorrectly converted monthly frequency goals into day-interval
-- values but stored them with goal_unit='week'. E.g. "2x/month" → interval of 15 days
-- → became goal_count=15, goal_unit='week'. Frequencies >7x/week are unreasonable
-- for social contact and all match this corruption pattern.
-- Reverse: original_monthly_count = ROUND(30 / corrupted_count)
UPDATE friends
SET
  goal_count = ROUND(30.0 / goal_count)::integer,
  goal_unit  = 'month'
WHERE goal_unit = 'week' AND goal_count > 7;

-- Add per-friend background info field (distinct from notes which appear in reminders)
ALTER TABLE friends ADD COLUMN IF NOT EXISTS details text;

-- Remove the unused goal_mode column added by a bad migration (not referenced in UI)
ALTER TABLE friends DROP COLUMN IF EXISTS goal_mode;
