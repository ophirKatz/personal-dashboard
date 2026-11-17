-- Distance-based workout exercises (running): the amount is kilometres instead of sets x reps.
--
-- An item with distance_km set is a distance item. sets/reps are still required by the existing
-- columns, so the app stores 1/1 alongside it and ignores them. Null distance_km means a normal
-- sets x reps item, which is every row that exists today.
alter table public.workout_preset_exercises
  add column if not exists distance_km numeric(6, 2) check (distance_km is null or distance_km > 0);

alter table public.workout_log_exercises
  add column if not exists distance_km numeric(6, 2) check (distance_km is null or distance_km > 0);
