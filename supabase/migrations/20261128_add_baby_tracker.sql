-- Baby tracker, shared between parents.
--
-- The unit of sharing is the baby, not a user: `babies` has members (`baby_members`) and
-- every log entry (`baby_events`) belongs to a baby. A parent can read and write everything,
-- a viewer can only read, and anyone who isn't a member sees nothing. Nothing here is
-- reachable by `anon`, and there are no public links.
--
-- Joining goes through `baby_invites`: a parent creates a single-use, expiring token link
-- (122 bits, like meal_shares) and the invited person accepts it with accept_baby_invite().
-- An invite can be tied to one email address, so a forwarded link is useless to anyone else.
--
-- Hard-to-reverse operations are avoided on purpose:
--   * events are never removed by clients: they are marked with deleted_at (so an undo works,
--     the other parent's screen gets an UPDATE it is allowed to see, and nothing is lost by a
--     mis-tap). There is no remove policy at all.
--   * members are never removed either: leaving or being removed sets removed_at, so older
--     entries still show who logged them.
--   * invites are revoked with revoked_at.
-- The Supabase MCP holds statements that remove objects for a confirmation that never reaches
-- the user (see CLAUDE.md), so this file has none, and the one validator that will grow with
-- new entry types is a function that can be replaced, not a constraint that would need removing.
-- Apart from this comment, the file is what is applied to the live project.

-- Helpers live in a schema the Data API doesn't expose, so they can't be called from the
-- browser as RPCs. Policies evaluate them with the caller's privileges, hence the grants.
create schema private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- What `details` may hold for each entry type. Strict for the types the app writes today;
-- the others only have to be a JSON object. Replace this function to tighten or add types.
create function private.baby_event_details_ok(p_type text, p_details jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_method text;
  v_key text;
begin
  if p_details is null or jsonb_typeof(p_details) <> 'object' or length(p_details::text) > 2000 then
    return false;
  end if;

  if p_type = 'feed' then
    v_method := p_details ->> 'method';
    if v_method is null or v_method not in ('breast', 'bottle', 'solids') then
      return false;
    end if;
    if v_method = 'breast' and (p_details ->> 'side') is not null
       and (p_details ->> 'side') not in ('left', 'right', 'both') then
      return false;
    end if;
    if v_method = 'bottle' then
      if (p_details -> 'ml') is not null and jsonb_typeof(p_details -> 'ml') <> 'null' then
        if jsonb_typeof(p_details -> 'ml') <> 'number' then
          return false;
        end if;
        if (p_details ->> 'ml')::numeric not between 1 and 600 then
          return false;
        end if;
      end if;
      if (p_details ->> 'content') is not null
         and (p_details ->> 'content') not in ('breast_milk', 'formula') then
        return false;
      end if;
    end if;
  elsif p_type = 'diaper' then
    if (p_details ->> 'kind') is null or (p_details ->> 'kind') not in ('wet', 'dirty', 'both', 'dry') then
      return false;
    end if;
    if (p_details ->> 'stool_color') is not null
       and (p_details ->> 'stool_color') not in ('black', 'green', 'yellow', 'brown', 'orange', 'red', 'grey_white') then
      return false;
    end if;
  elsif p_type = 'pump' then
    -- Millilitres from each side. Either may be left out; a running pump timer has neither yet.
    foreach v_key in array array['ml_left', 'ml_right'] loop
      if (p_details -> v_key) is not null and jsonb_typeof(p_details -> v_key) <> 'null' then
        if jsonb_typeof(p_details -> v_key) <> 'number' then
          return false;
        end if;
        if (p_details ->> v_key)::numeric not between 0 and 1000 then
          return false;
        end if;
      end if;
    end loop;
  elsif p_type = 'temperature' then
    if (p_details -> 'c') is not null and jsonb_typeof(p_details -> 'c') <> 'null' then
      if jsonb_typeof(p_details -> 'c') <> 'number' then
        return false;
      end if;
      if (p_details ->> 'c')::numeric not between 30 and 45 then
        return false;
      end if;
    end if;
  end if;

  return true;
end;
$$;

create table public.babies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  -- Optional so the tracker can be set up before the birth.
  birth_date date,
  -- Only used to pick the growth chart (they differ by sex).
  sex text check (sex in ('female', 'male')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.baby_members (
  baby_id uuid not null references public.babies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('parent', 'viewer')),
  -- Shown next to the entries this person logged. Kept after they leave.
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  created_at timestamptz not null default now(),
  -- Set when the person leaves or is removed; the row stays so old entries keep their name.
  removed_at timestamptz,
  primary key (baby_id, user_id)
);

create index baby_members_user_id_idx on public.baby_members (user_id) where removed_at is null;

create table public.baby_invites (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  -- The only credential the invite has: 122 bits of randomness.
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  role text not null default 'parent' check (role in ('parent', 'viewer')),
  -- When set (lower case), only the signed-in account with this email can accept.
  invited_email text check (
    invited_email is null
    or (invited_email = lower(btrim(invited_email)) and position('@' in invited_email) > 1)
  ),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index baby_invites_baby_id_idx on public.baby_invites (baby_id);

create table public.baby_events (
  -- Generated by the app, so a retried save can't create a duplicate.
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  type text not null check (type in ('feed', 'diaper', 'sleep', 'pump', 'temperature', 'medication', 'growth', 'note')),
  started_at timestamptz not null default now(),
  -- null for point-in-time entries and while a timer is running.
  ended_at timestamptz,
  -- A running timer (sleep, breast feed, pumping). Both parents see it and either can stop it.
  in_progress boolean not null default false,
  details jsonb not null default '{}'::jsonb,
  note text check (char_length(note) <= 500),
  logged_by uuid default auth.uid() references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint baby_events_details_ok check (private.baby_event_details_ok(type, details)),
  constraint baby_events_time_order check (ended_at is null or ended_at >= started_at),
  constraint baby_events_timer_open check (not (in_progress and ended_at is not null)),
  constraint baby_events_timer_types check (not in_progress or type in ('sleep', 'feed', 'pump'))
);

create index baby_events_timeline_idx on public.baby_events (baby_id, started_at desc);

-- One running timer of each kind per baby, so two phones can't both start a sleep.
create unique index baby_events_one_running
  on public.baby_events (baby_id, type)
  where in_progress and deleted_at is null;

-- Membership checks used by every policy. SECURITY DEFINER so they can read baby_members
-- without going through its own policy (which would recurse).
create function private.is_baby_member(p_baby_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.baby_members m
    where m.baby_id = p_baby_id
      and m.user_id = (select auth.uid())
      and m.removed_at is null
  )
$$;

create function private.is_baby_parent(p_baby_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.baby_members m
    where m.baby_id = p_baby_id
      and m.user_id = (select auth.uid())
      and m.removed_at is null
      and m.role = 'parent'
  )
$$;

revoke all on function private.baby_event_details_ok(text, jsonb) from public;
revoke all on function private.is_baby_member(uuid) from public;
revoke all on function private.is_baby_parent(uuid) from public;
grant execute on function private.baby_event_details_ok(text, jsonb) to authenticated;
grant execute on function private.is_baby_member(uuid) to authenticated;
grant execute on function private.is_baby_parent(uuid) to authenticated;

-- Stamps who changed an entry and when, whatever the client sent.
create function private.touch_baby_event()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger baby_events_touch
  before update on public.baby_events
  for each row execute function private.touch_baby_event();

-- Rules for changing who is in a tracker, for requests coming from the app. Not SECURITY
-- DEFINER on purpose: current_user is then the caller, so changes made by trusted code
-- (accept_baby_invite runs as the table owner) skip these rules.
create function private.guard_baby_member_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if new.role is distinct from old.role or new.removed_at is distinct from old.removed_at then
    -- Leaving is always allowed. Removing someone else or changing a role takes a parent.
    if not (
      old.user_id = v_uid
      and old.removed_at is null
      and new.removed_at is not null
      and new.role = old.role
    ) then
      if not private.is_baby_parent(old.baby_id) then
        raise exception 'Only a parent can change who is in the tracker' using errcode = '42501';
      end if;
    end if;

    -- A baby always keeps at least one parent.
    if old.role = 'parent' and old.removed_at is null
       and (new.role <> 'parent' or new.removed_at is not null)
       and not exists (
         select 1
         from public.baby_members m
         where m.baby_id = old.baby_id
           and m.user_id <> old.user_id
           and m.role = 'parent'
           and m.removed_at is null
       ) then
      raise exception 'A baby needs at least one parent' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger baby_members_guard
  before update on public.baby_members
  for each row execute function private.guard_baby_member_update();

-- Table access: nothing for anon, and only the columns the app is meant to change for
-- signed-in users (RLS then decides which rows).
alter table public.babies enable row level security;
alter table public.baby_members enable row level security;
alter table public.baby_invites enable row level security;
alter table public.baby_events enable row level security;

revoke all on public.babies from anon, authenticated;
revoke all on public.baby_members from anon, authenticated;
revoke all on public.baby_invites from anon, authenticated;
revoke all on public.baby_events from anon, authenticated;

grant select on public.babies to authenticated;
grant update (name, birth_date, sex) on public.babies to authenticated;

grant select on public.baby_members to authenticated;
grant update (display_name, role, removed_at) on public.baby_members to authenticated;

grant select on public.baby_invites to authenticated;
grant insert (baby_id, role, invited_email) on public.baby_invites to authenticated;
grant update (revoked_at) on public.baby_invites to authenticated;

grant select on public.baby_events to authenticated;
grant insert (id, baby_id, type, started_at, ended_at, in_progress, details, note, logged_by)
  on public.baby_events to authenticated;
grant update (type, started_at, ended_at, in_progress, details, note, deleted_at)
  on public.baby_events to authenticated;

-- A baby is created through create_baby(), which also makes the creator its first parent.
create policy "members read babies" on public.babies
  for select to authenticated
  using (private.is_baby_member(id));

create policy "parents edit babies" on public.babies
  for update to authenticated
  using (private.is_baby_parent(id))
  with check (private.is_baby_parent(id));

-- Every member sees the whole member list (names for the timeline). Joining happens only
-- through accept_baby_invite(); changing who is in goes through the guard trigger above.
create policy "members read baby_members" on public.baby_members
  for select to authenticated
  using (private.is_baby_member(baby_id));

create policy "members edit baby_members" on public.baby_members
  for update to authenticated
  using (removed_at is null and (user_id = (select auth.uid()) or private.is_baby_parent(baby_id)))
  with check (user_id = (select auth.uid()) or private.is_baby_parent(baby_id));

create policy "parents read baby_invites" on public.baby_invites
  for select to authenticated
  using (private.is_baby_parent(baby_id));

create policy "parents create baby_invites" on public.baby_invites
  for insert to authenticated
  with check (private.is_baby_parent(baby_id) and created_by = (select auth.uid()));

create policy "parents revoke baby_invites" on public.baby_invites
  for update to authenticated
  using (private.is_baby_parent(baby_id))
  with check (private.is_baby_parent(baby_id));

create policy "members read baby_events" on public.baby_events
  for select to authenticated
  using (private.is_baby_member(baby_id));

-- logged_by has to be the caller, so nobody can log an entry in someone else's name.
create policy "parents add baby_events" on public.baby_events
  for insert to authenticated
  with check (private.is_baby_parent(baby_id) and logged_by = (select auth.uid()));

create policy "parents edit baby_events" on public.baby_events
  for update to authenticated
  using (private.is_baby_parent(baby_id))
  with check (private.is_baby_parent(baby_id));

-- Creates a baby and makes the caller its first parent, in one step.
create function public.create_baby(
  p_name text,
  p_birth_date date,
  p_sex text,
  p_display_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_baby_id uuid;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  insert into public.babies (name, birth_date, sex, created_by)
  values (btrim(p_name), p_birth_date, p_sex, v_uid)
  returning id into v_baby_id;

  insert into public.baby_members (baby_id, user_id, role, display_name)
  values (v_baby_id, v_uid, 'parent', btrim(p_display_name));

  return v_baby_id;
end;
$$;

-- Joins the caller to the baby behind an invite token. Returns
--   {status: 'ok' | 'already_member', baby_id}   or
--   {status: 'invalid' | 'wrong_email' | 'invalid_name'}.
-- 'invalid' covers unknown, revoked, used and expired links alike, so a guess learns nothing.
-- Opening a link again after joining with it is still 'ok'.
create function public.accept_baby_invite(p_token text, p_display_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(btrim(coalesce(auth.jwt() ->> 'email', '')));
  v_name text := btrim(coalesce(p_display_name, ''));
  v_invite public.baby_invites;
  v_active boolean;
begin
  if v_uid is null then
    return jsonb_build_object('status', 'invalid');
  end if;

  select * into v_invite
  from public.baby_invites
  where token = p_token
  for update;
  if not found or v_invite.revoked_at is not null then
    return jsonb_build_object('status', 'invalid');
  end if;

  select exists (
    select 1
    from public.baby_members m
    where m.baby_id = v_invite.baby_id and m.user_id = v_uid and m.removed_at is null
  ) into v_active;

  if v_active then
    return jsonb_build_object(
      'status', case when v_invite.accepted_by = v_uid then 'ok' else 'already_member' end,
      'baby_id', v_invite.baby_id
    );
  end if;

  if v_invite.accepted_at is not null or v_invite.expires_at <= now() then
    return jsonb_build_object('status', 'invalid');
  end if;

  if v_invite.invited_email is not null and v_invite.invited_email <> v_email then
    return jsonb_build_object('status', 'wrong_email');
  end if;

  if char_length(v_name) not between 1 and 40 then
    return jsonb_build_object('status', 'invalid_name');
  end if;

  insert into public.baby_members (baby_id, user_id, role, display_name)
  values (v_invite.baby_id, v_uid, v_invite.role, v_name)
  on conflict (baby_id, user_id) do update
    set role = excluded.role,
        display_name = excluded.display_name,
        removed_at = null;

  update public.baby_invites
  set accepted_by = v_uid, accepted_at = now()
  where id = v_invite.id;

  return jsonb_build_object('status', 'ok', 'baby_id', v_invite.baby_id);
end;
$$;

-- Supabase grants EXECUTE on new public functions to anon and authenticated directly, so
-- revoking from PUBLIC alone leaves anon able to call them.
revoke all on function public.create_baby(text, date, text, text) from public, anon;
revoke all on function public.accept_baby_invite(text, text) from public, anon;
grant execute on function public.create_baby(text, date, text, text) to authenticated;
grant execute on function public.accept_baby_invite(text, text) to authenticated;

-- Live updates between the parents' phones. Realtime applies the SELECT policy to inserts
-- and updates, so each parent only receives their own babies' entries.
alter publication supabase_realtime add table public.baby_events;
