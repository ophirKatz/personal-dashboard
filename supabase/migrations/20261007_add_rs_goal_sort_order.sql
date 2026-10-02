-- Manual priority ordering for RuneScape goals (lower = higher priority).
-- New goals default to 0 so they land at the top, matching the old newest-first order.
alter table public.rs_goals add column if not exists sort_order int not null default 0;

-- Backfill existing goals so they keep their current newest-first order.
update public.rs_goals g
set sort_order = r.rn
from (
  select id, row_number() over (partition by character_id order by created_at desc) as rn
  from public.rs_goals
) r
where g.id = r.id;
