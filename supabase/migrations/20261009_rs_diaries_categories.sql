-- Diaries tracker now covers every wiki "area" achievement set: Area Tasks (tiered) and Exploration (untiered).
alter table public.rs_diary_tasks add column if not exists category text not null default 'Area Tasks';
alter table public.rs_diary_tasks add column if not exists description text;
alter table public.rs_diary_tasks drop constraint if exists rs_diary_tasks_tier_check;
alter table public.rs_diary_tasks add constraint rs_diary_tasks_tier_check
  check (tier in ('Beginner', 'Easy', 'Medium', 'Hard', 'Elite', 'All'));
