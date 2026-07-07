
-- Switch goal_unit constraint to include 'year'
ALTER TABLE friends DROP CONSTRAINT friends_goal_unit_check;
ALTER TABLE friends ADD CONSTRAINT friends_goal_unit_check
  CHECK (goal_unit IN ('day', 'week', 'month', 'year'));

-- Convert existing "N times per unit" rows to "every N units" semantics.
-- Rows with goal_count = 1 are unchanged (1x/week = every 1 week).
-- Rows with goal_count > 1 are converted to an approximate interval:
--   2x/week → every 4 days, 3x/week → every 2 days, etc.
UPDATE friends SET
  goal_unit = CASE
    WHEN goal_count > 1 AND goal_unit = 'week'  THEN 'day'
    WHEN goal_count > 1 AND goal_unit = 'month' THEN 'week'
    ELSE goal_unit
  END,
  goal_count = CASE
    WHEN goal_count > 1 AND goal_unit = 'week'  THEN GREATEST(1, ROUND(7.0  / goal_count)::integer)
    WHEN goal_count > 1 AND goal_unit = 'month' THEN GREATEST(1, ROUND(30.0 / goal_count)::integer)
    ELSE goal_count
  END
WHERE goal_count > 1;
