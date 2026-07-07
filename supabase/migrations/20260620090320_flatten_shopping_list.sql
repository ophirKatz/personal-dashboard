-- Flatten shopping list: drop multi-list support, make shopping_items a single flat list per user
alter table public.shopping_items drop constraint if exists shopping_items_list_id_fkey;
alter table public.shopping_items drop column if exists list_id;
drop table if exists public.shopping_lists;
