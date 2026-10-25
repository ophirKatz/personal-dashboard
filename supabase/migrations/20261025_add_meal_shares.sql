-- Meal idea share links: a time-limited page that works without logging in, so
-- someone who isn't a user can shuffle through meals and tell the owner which
-- one they like.
--
-- The table is owner-only (RLS, no anon policies), so it can't be listed or
-- guessed at. Anonymous visitors only ever go through the two SECURITY DEFINER
-- functions below, each of which requires the unguessable token and an
-- unexpired link.
--
-- No statements that remove objects (no "if exists" re-run guards) on purpose: the
-- Supabase MCP tools hold those for a confirmation that never reaches the user,
-- so the call just times out (see CLAUDE.md). Everything below is new, so plain
-- `create` is enough. Apart from this comment, the file is exactly what was
-- applied to the live project.
create table if not exists public.meal_shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- 122 bits of randomness; this is the only credential the public page has.
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  -- Which meals the link offers. Fixed per link, chosen when it's created.
  tag text not null check (tag in ('all', 'breakfast', 'lunch', 'dinner', 'dessert')),
  picked_meal_id uuid references public.meals(id) on delete set null,
  picked_at timestamptz,
  expires_at timestamptz not null default now() + interval '24 hours',
  created_at timestamptz not null default now()
);

create index if not exists meal_shares_user_id_idx on public.meal_shares (user_id);

alter table public.meal_shares enable row level security;

create policy "user owns meal shares"
  on public.meal_shares
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Public read: the meals behind a token, or NULL when the token is unknown or
-- expired. Reads `meals` live, so edits show up on the next load. Exposes only
-- what the page renders - never user_id or recipe_id.
create or replace function public.get_meal_share(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'tag', s.tag,
    'expires_at', s.expires_at,
    'picked_meal_id', s.picked_meal_id,
    'meals', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', m.id,
          'name', m.name,
          'description', m.description,
          'tags', m.tags,
          'image_url', coalesce(m.image_url, r.image_url)
        )
        order by m.name
      )
      from public.meals m
      left join public.recipes r on r.id = m.recipe_id
      where m.user_id = s.user_id
        and (s.tag = 'all' or s.tag = any (m.tags))
    ), '[]'::jsonb)
  )
  from public.meal_shares s
  where s.token = p_token
    and s.expires_at > now()
$$;

-- Public write: record which meal was picked. Returns 'ok', 'expired' (unknown
-- or expired token) or 'invalid_meal' (not one of this link's meals, e.g. it
-- was deleted since the page loaded). Re-picking the same meal is a no-op, so
-- it doesn't change the row and doesn't fire the notification again.
create or replace function public.pick_meal_share(p_token text, p_meal_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_share public.meal_shares;
begin
  select * into v_share
  from public.meal_shares
  where token = p_token
    and expires_at > now();
  if not found then
    return 'expired';
  end if;

  if not exists (
    select 1
    from public.meals m
    where m.id = p_meal_id
      and m.user_id = v_share.user_id
      and (v_share.tag = 'all' or v_share.tag = any (m.tags))
  ) then
    return 'invalid_meal';
  end if;

  if v_share.picked_meal_id is distinct from p_meal_id then
    update public.meal_shares
    set picked_meal_id = p_meal_id,
        picked_at = now()
    where id = v_share.id;
  end if;

  return 'ok';
end;
$$;

revoke all on function public.get_meal_share(text) from public;
revoke all on function public.pick_meal_share(text, uuid) from public;
grant execute on function public.get_meal_share(text) to anon, authenticated;
grant execute on function public.pick_meal_share(text, uuid) to anon, authenticated;

-- Push notification when a meal is picked. Authenticates to the edge function
-- with the cron_secret from Vault, same as the other DB-triggered functions
-- (see SETUP.md). A failed request must never fail the pick itself.
create or replace function public.notify_meal_pick()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform net.http_post(
    url := 'https://tjjvrqamitwtoslinrxy.supabase.co/functions/v1/send-meal-pick-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := jsonb_build_object('share_id', new.id)
  );
  return new;
exception when others then
  raise warning 'notify_meal_pick failed: %', sqlerrm;
  return new;
end;
$$;

revoke all on function public.notify_meal_pick() from public;

create trigger meal_shares_notify_pick
  after update of picked_meal_id on public.meal_shares
  for each row
  when (new.picked_meal_id is not null and old.picked_meal_id is distinct from new.picked_meal_id)
  execute function public.notify_meal_pick();
