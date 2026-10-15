-- Wealth tracking: accounts/holdings (items), a dated balance ledger (snapshots)
-- and financial goals.
--
-- Items hold identity + metadata only. Balances live in wealth_snapshots, so
-- there is no balance column to keep in sync and every balance edit is history.
-- An item's current balance is its latest snapshot.
--
-- "owner" is a label (Ophir / Yael / Shared), not a second account: every row
-- still belongs to the single signed-in user via user_id + RLS.

create table if not exists public.wealth_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  -- Built-in category key (bank, pension, study_fund, ...). Validated in the
  -- app so new built-ins don't need a migration; unknown values read as 'other'.
  category text not null default 'other',
  owner text not null default 'ophir' check (owner in ('ophir', 'yael', 'shared')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists wealth_items_user_id_idx on public.wealth_items (user_id);

create table if not exists public.wealth_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.wealth_items(id) on delete cascade,
  -- No default: the client sends its local date (the DB's current_date is UTC,
  -- which is the wrong day for late-night entries in Israel).
  recorded_on date not null,
  balance numeric(18, 2) not null, -- negatives allowed (e.g. a loan)
  currency text not null default 'ils', -- a CurrencyCode from features/finance/currency.ts
  created_at timestamptz not null default now(),
  -- One value per item per day: editing twice in a day overwrites, and a past
  -- date can be backfilled.
  unique (item_id, recorded_on)
);

create index if not exists wealth_snapshots_user_id_idx on public.wealth_snapshots (user_id);
create index if not exists wealth_snapshots_item_date_idx on public.wealth_snapshots (item_id, recorded_on desc);

create table if not exists public.wealth_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_amount numeric(18, 2) not null check (target_amount > 0), -- always NIS
  target_date date,
  -- Whose wealth counts toward this goal. All three = everyone.
  scope text[] not null default '{ophir,yael,shared}'
    check (cardinality(scope) > 0 and scope <@ array['ophir', 'yael', 'shared']),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists wealth_goals_user_id_idx on public.wealth_goals (user_id);

alter table public.wealth_items enable row level security;
alter table public.wealth_snapshots enable row level security;
alter table public.wealth_goals enable row level security;

drop policy if exists "user owns wealth_items" on public.wealth_items;
create policy "user owns wealth_items"
  on public.wealth_items
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user owns wealth_snapshots" on public.wealth_snapshots;
create policy "user owns wealth_snapshots"
  on public.wealth_snapshots
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user owns wealth_goals" on public.wealth_goals;
create policy "user owns wealth_goals"
  on public.wealth_goals
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
