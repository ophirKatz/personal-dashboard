// Runs supabase/migrations/20261128_add_baby_tracker.sql against an in-process Postgres
// (PGlite) with just enough of Supabase's auth stubbed. The migration is applied to production
// only after review, so this is what proves the SQL runs and that the sharing rules hold at the
// database: who can read a baby's log, who can write to it, and how someone gets let in.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import migration from '../../../supabase/migrations/20261128_add_baby_tracker.sql?raw'

const db = new PGlite()

type Row = Record<string, any>
const q = async <T = Row>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows

type Role = 'anon' | 'authenticated' | 'postgres'
async function as(role: Role, uid = '', email = '') {
  await db.exec(`reset role; select set_config('test.uid', '${uid}', false), set_config('test.email', '${email}', false);`)
  if (role !== 'postgres') await db.exec(`set role ${role}`)
}

const MOM = '00000000-0000-0000-0000-0000000000a1'
const DAD = '00000000-0000-0000-0000-0000000000a2'
const GRANNY = '00000000-0000-0000-0000-0000000000a3'
const STRANGER = '00000000-0000-0000-0000-0000000000a4'
const EMAIL: Record<string, string> = {
  [MOM]: 'mom@example.com',
  [DAD]: 'Dad@Example.com',
  [GRANNY]: 'granny@example.com',
  [STRANGER]: 'stranger@example.com',
}
const asUser = (uid: string) => as('authenticated', uid, EMAIL[uid])

let babyId: string

const bottle = { method: 'bottle', ml: 90, content: 'formula' }

async function logEvent(uid: string, overrides: Row = {}) {
  await asUser(uid)
  const e: Row = { type: 'feed', details: bottle, started_at: '2026-11-28T10:00:00Z', ...overrides }
  const [row] = await q(
    `insert into public.baby_events (baby_id, type, details, started_at, ended_at, in_progress, note)
     values ($1, $2, $3, $4, $5, $6, $7) returning *`,
    [e.baby_id ?? babyId, e.type, JSON.stringify(e.details), e.started_at, e.ended_at ?? null, e.in_progress ?? false, e.note ?? null],
  )
  return row
}

async function invite(uid: string, email: string | null = null, role = 'parent') {
  await asUser(uid)
  const [row] = await q(
    `insert into public.baby_invites (baby_id, invited_email, role) values ($1, $2, $3) returning *`,
    [babyId, email, role],
  )
  return row
}

const accept = async (uid: string, token: string, name = 'Dad') => {
  await asUser(uid)
  return (await q<{ r: Row }>(`select public.accept_baby_invite($1, $2) as r`, [token, name]))[0].r
}

const isMember = async (uid: string) => {
  await as('postgres')
  const rows = await q(`select 1 from public.baby_members where baby_id = $1 and user_id = $2 and removed_at is null`, [babyId, uid])
  return rows.length > 0
}

beforeAll(async () => {
  // Supabase stand-ins: API roles, auth.uid() / auth.jwt(), the realtime publication.
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key default gen_random_uuid());
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as
      $$ select jsonb_build_object('email', nullif(current_setting('test.email', true), '')) $$;
    create publication supabase_realtime;

    -- Supabase hands API roles table access and EXECUTE on every new function, directly
    -- (not via PUBLIC), and relies on RLS and the migration's own revokes to restrict them.
    grant usage on schema public, auth to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant execute on functions to anon, authenticated;

    insert into auth.users values ('${MOM}'), ('${DAD}'), ('${GRANNY}'), ('${STRANGER}');
  `)
  await db.exec(migration)
}, 30_000)

afterAll(() => db.close())

beforeEach(async () => {
  await as('postgres')
  await db.exec(`truncate public.babies cascade`)
  // Mom sets the tracker up; Dad joins as a parent and Granny as a viewer.
  await asUser(MOM)
  babyId = (await q<{ id: string }>(`select public.create_baby('Noa', null, 'female', 'Mom') as id`))[0].id
  await as('postgres')
  await q(
    `insert into public.baby_members (baby_id, user_id, role, display_name)
     values ($1, $2, 'parent', 'Dad'), ($1, $3, 'viewer', 'Granny')`,
    [babyId, DAD, GRANNY],
  )
})

describe('create_baby', () => {
  it('creates the baby and makes the caller its first parent', async () => {
    await asUser(STRANGER)
    const [{ id }] = await q<{ id: string }>(`select public.create_baby('  Ori ', '2026-12-01', 'male', ' Dad ') as id`)
    const [baby] = await q(`select * from public.babies where id = $1`, [id])
    expect(baby).toMatchObject({ name: 'Ori', sex: 'male', created_by: STRANGER })
    const [member] = await q(`select * from public.baby_members where baby_id = $1`, [id])
    expect(member).toMatchObject({ user_id: STRANGER, role: 'parent', display_name: 'Dad', removed_at: null })
  })

  it('allows a baby with no birth date yet', async () => {
    await asUser(STRANGER)
    const [{ id }] = await q<{ id: string }>(`select public.create_baby('Baby', null, null, 'Me') as id`)
    const [baby] = await q(`select birth_date, sex from public.babies where id = $1`, [id])
    expect(baby).toEqual({ birth_date: null, sex: null })
  })

  it('rejects a blank name, an unknown sex and a blank display name', async () => {
    await asUser(STRANGER)
    await expect(q(`select public.create_baby('  ', null, null, 'Me')`)).rejects.toThrow(/check/)
    await expect(q(`select public.create_baby('Baby', null, 'other', 'Me')`)).rejects.toThrow(/check/)
    await expect(q(`select public.create_baby('Baby', null, null, ' ')`)).rejects.toThrow(/check/)
  })

  it('is not callable without signing in', async () => {
    await as('anon')
    await expect(q(`select public.create_baby('Baby', null, null, 'Me')`)).rejects.toThrow(/permission denied/)
  })

  it('cannot be bypassed by inserting straight into the tables', async () => {
    await asUser(STRANGER)
    await expect(q(`insert into public.babies (name) values ('Sneaky')`)).rejects.toThrow(/permission denied/)
    await expect(
      q(`insert into public.baby_members (baby_id, user_id, role, display_name) values ($1, $2, 'parent', 'Me')`, [babyId, STRANGER]),
    ).rejects.toThrow(/permission denied/)
  })
})

describe('who can see a baby', () => {
  beforeEach(async () => {
    await logEvent(MOM)
    await invite(MOM)
  })

  it('shows members the baby, its members and its entries', async () => {
    for (const uid of [MOM, DAD, GRANNY]) {
      await asUser(uid)
      expect(await q(`select * from public.babies`)).toHaveLength(1)
      expect(await q(`select * from public.baby_members`)).toHaveLength(3)
      expect(await q(`select * from public.baby_events`)).toHaveLength(1)
    }
  })

  it('shows a stranger nothing at all', async () => {
    await asUser(STRANGER)
    expect(await q(`select * from public.babies`)).toHaveLength(0)
    expect(await q(`select * from public.baby_members`)).toHaveLength(0)
    expect(await q(`select * from public.baby_events`)).toHaveLength(0)
    expect(await q(`select * from public.baby_invites`)).toHaveLength(0)
  })

  it('gives anon no access to any of the tables', async () => {
    await as('anon')
    for (const table of ['babies', 'baby_members', 'baby_invites', 'baby_events']) {
      await expect(q(`select * from public.${table}`)).rejects.toThrow(/permission denied/)
    }
  })

  it("keeps one baby's log out of another baby's members", async () => {
    await asUser(STRANGER)
    const [{ id: otherBaby }] = await q<{ id: string }>(`select public.create_baby('Other', null, null, 'S') as id`)
    await logEvent(STRANGER, { baby_id: otherBaby, note: 'private' })
    await asUser(DAD)
    const seen = await q(`select baby_id from public.baby_events`)
    expect(seen.map(r => r.baby_id)).toEqual([babyId])
  })

  it('hides the invite tokens from viewers', async () => {
    await asUser(GRANNY)
    expect(await q(`select * from public.baby_invites`)).toHaveLength(0)
    await asUser(DAD)
    expect(await q(`select * from public.baby_invites`)).toHaveLength(1)
  })
})

describe('baby_events: writing', () => {
  it('stamps the caller as the author', async () => {
    const e = await logEvent(DAD)
    expect(e.logged_by).toBe(DAD)
    expect(e.deleted_at).toBeNull()
  })

  it("won't log an entry in someone else's name", async () => {
    await asUser(DAD)
    await expect(
      q(`insert into public.baby_events (baby_id, type, details, logged_by) values ($1, 'diaper', '{"kind":"wet"}', $2)`, [babyId, MOM]),
    ).rejects.toThrow(/row-level security/)
  })

  it('lets a parent log, but not a viewer or a stranger', async () => {
    await expect(logEvent(MOM)).resolves.toBeTruthy()
    await expect(logEvent(GRANNY)).rejects.toThrow(/row-level security/)
    await expect(logEvent(STRANGER)).rejects.toThrow(/row-level security/)
  })

  it('lets either parent edit an entry; the editor is recorded', async () => {
    const e = await logEvent(MOM)
    await asUser(DAD)
    await q(`update public.baby_events set note = 'burped well' where id = $1`, [e.id])
    const [after] = await q(`select note, logged_by, updated_by, updated_at > created_at as touched from public.baby_events where id = $1`, [e.id])
    expect(after).toMatchObject({ note: 'burped well', logged_by: MOM, updated_by: DAD })
  })

  it("won't let a viewer or a stranger change an entry", async () => {
    const e = await logEvent(MOM)
    for (const uid of [GRANNY, STRANGER]) {
      await asUser(uid)
      await q(`update public.baby_events set note = 'x' where id = $1`, [e.id])
    }
    await as('postgres')
    const [row] = await q(`select note from public.baby_events where id = $1`, [e.id])
    expect(row.note).toBeNull()
  })

  it('does not let the author, baby or timestamps be rewritten', async () => {
    const e = await logEvent(MOM)
    await asUser(MOM)
    for (const set of [`logged_by = '${DAD}'`, `created_at = now()`, `updated_by = '${DAD}'`, `id = gen_random_uuid()`]) {
      await expect(q(`update public.baby_events set ${set} where id = $1`, [e.id])).rejects.toThrow(/permission denied/)
    }
    await expect(
      q(`insert into public.baby_events (baby_id, type, details, created_at) values ($1, 'note', '{}', '2020-01-01')`, [babyId]),
    ).rejects.toThrow(/permission denied/)
  })

  it('cannot move an entry to a baby the caller is not a parent of', async () => {
    const e = await logEvent(MOM)
    await asUser(MOM)
    await expect(q(`update public.baby_events set baby_id = gen_random_uuid() where id = $1`, [e.id])).rejects.toThrow(/permission denied/)
  })

  it('cannot be removed, only marked deleted', async () => {
    const e = await logEvent(MOM)
    await asUser(MOM)
    await expect(q(`delete from public.baby_events where id = $1`, [e.id])).rejects.toThrow(/permission denied/)
    await q(`update public.baby_events set deleted_at = now() where id = $1`, [e.id])
    // Still there for the other parent to receive as an update, and for undo.
    await asUser(DAD)
    const [row] = await q(`select deleted_at from public.baby_events where id = $1`, [e.id])
    expect(row.deleted_at).not.toBeNull()
    await asUser(MOM)
    await q(`update public.baby_events set deleted_at = null where id = $1`, [e.id])
    const [back] = await q(`select deleted_at from public.baby_events where id = $1`, [e.id])
    expect(back.deleted_at).toBeNull()
  })

  it('accepts a retried save under the same id only once', async () => {
    await asUser(MOM)
    const id = '11111111-1111-1111-1111-111111111111'
    const insert = () => q(
      `insert into public.baby_events (id, baby_id, type, details) values ($1, $2, 'diaper', '{"kind":"wet"}')`,
      [id, babyId],
    )
    await insert()
    await expect(insert()).rejects.toThrow(/baby_events_pkey/)
    expect(await q(`select * from public.baby_events`)).toHaveLength(1)
  })
})

describe('baby_events: what an entry may contain', () => {
  const bad = (type: string, details: unknown) =>
    expect(logEvent(MOM, { type, details })).rejects.toThrow(/baby_events_details_ok/)
  const good = (type: string, details: unknown, extra: Row = {}) =>
    expect(logEvent(MOM, { type, details, ...extra })).resolves.toBeTruthy()

  it('requires a feed to say how it was fed', async () => {
    await bad('feed', {})
    await bad('feed', { method: 'cup' })
    await good('feed', { method: 'breast', side: 'left' })
    await good('feed', { method: 'breast' })
    await good('feed', { method: 'solids', food: 'banana' })
  })

  it('checks side, amount and content of a feed', async () => {
    await bad('feed', { method: 'breast', side: 'up' })
    await bad('feed', { method: 'bottle', ml: 0 })
    await bad('feed', { method: 'bottle', ml: 601 })
    await bad('feed', { method: 'bottle', ml: '90' })
    await bad('feed', { method: 'bottle', content: 'juice' })
    await good('feed', { method: 'bottle', ml: 600, content: 'breast_milk' })
    await good('feed', { method: 'bottle' })
  })

  it('requires a diaper to say what it was, and knows the stool colors', async () => {
    await bad('diaper', {})
    await bad('diaper', { kind: 'huge' })
    await bad('diaper', { kind: 'dirty', stool_color: 'blue' })
    await good('diaper', { kind: 'dirty', stool_color: 'grey_white' })
    await good('diaper', { kind: 'dry' })
  })

  it('keeps temperatures in a plausible range', async () => {
    await bad('temperature', { c: 20 })
    await bad('temperature', { c: 50 })
    await bad('temperature', { c: 'hot' })
    await good('temperature', { c: 38.2 })
  })

  it('needs details to be a JSON object of sane size', async () => {
    await bad('sleep', [])
    await bad('sleep', 'text')
    await bad('note', { big: 'x'.repeat(2100) })
    await good('sleep', {})
  })

  it('rejects unknown types, long notes and an end before the start', async () => {
    await expect(logEvent(MOM, { type: 'dance', details: {} })).rejects.toThrow(/check/)
    await expect(logEvent(MOM, { type: 'note', details: {}, note: 'x'.repeat(501) })).rejects.toThrow(/check/)
    await expect(
      logEvent(MOM, { type: 'sleep', details: {}, started_at: '2026-11-28T10:00:00Z', ended_at: '2026-11-28T09:00:00Z' }),
    ).rejects.toThrow(/baby_events_time_order/)
  })
})

describe('baby_events: running timers', () => {
  it('runs a sleep that both parents can see and either can stop', async () => {
    const sleep = await logEvent(MOM, { type: 'sleep', details: {}, in_progress: true })
    await asUser(DAD)
    expect((await q(`select id from public.baby_events where in_progress`))[0].id).toBe(sleep.id)
    await q(`update public.baby_events set in_progress = false, ended_at = now() + interval '1 hour' where id = $1`, [sleep.id])
    const [row] = await q(`select in_progress, ended_at from public.baby_events where id = $1`, [sleep.id])
    expect(row.in_progress).toBe(false)
    expect(row.ended_at).not.toBeNull()
  })

  it('allows only one running timer of a kind per baby', async () => {
    await logEvent(MOM, { type: 'sleep', details: {}, in_progress: true })
    await expect(logEvent(DAD, { type: 'sleep', details: {}, in_progress: true })).rejects.toThrow(/baby_events_one_running/)
    // A different kind of timer is fine, and so is a different baby.
    await expect(logEvent(DAD, { type: 'feed', details: { method: 'breast', side: 'left' }, in_progress: true })).resolves.toBeTruthy()
    await asUser(MOM)
    const [{ id: other }] = await q<{ id: string }>(`select public.create_baby('Twin', null, null, 'Mom') as id`)
    await expect(logEvent(MOM, { baby_id: other, type: 'sleep', details: {}, in_progress: true })).resolves.toBeTruthy()
  })

  it('lets a new timer start once the old one is stopped or removed', async () => {
    const first = await logEvent(MOM, { type: 'sleep', details: {}, in_progress: true })
    await asUser(MOM)
    await q(`update public.baby_events set deleted_at = now() where id = $1`, [first.id])
    await expect(logEvent(MOM, { type: 'sleep', details: {}, in_progress: true })).resolves.toBeTruthy()
  })

  it('only lets timers run for sleep, breast feeds and pumping, and only without an end', async () => {
    await expect(logEvent(MOM, { type: 'diaper', details: { kind: 'wet' }, in_progress: true })).rejects.toThrow(/baby_events_timer_types/)
    await expect(
      logEvent(MOM, { type: 'sleep', details: {}, in_progress: true, ended_at: '2026-11-28T11:00:00Z' }),
    ).rejects.toThrow(/baby_events_timer_open/)
  })
})

describe('joining with an invite', () => {
  it('gives a parent a single-use token that expires in a week', async () => {
    const inv = await invite(MOM)
    expect(inv.token).toMatch(/^[0-9a-f]{32}$/)
    expect(inv).toMatchObject({ role: 'parent', invited_email: null, accepted_at: null, revoked_at: null, created_by: MOM })
    expect(new Date(inv.expires_at).getTime() - new Date(inv.created_at).getTime()).toBe(7 * 24 * 3600 * 1000)
  })

  it('only lets parents create invites', async () => {
    await expect(invite(GRANNY)).rejects.toThrow(/row-level security/)
    await expect(invite(STRANGER)).rejects.toThrow(/row-level security/)
  })

  it('does not let the token, expiry or acceptance be chosen by the client', async () => {
    await asUser(MOM)
    await expect(q(`insert into public.baby_invites (baby_id, token) values ($1, 'guessable')`, [babyId])).rejects.toThrow(/permission denied/)
    await expect(q(`insert into public.baby_invites (baby_id, expires_at) values ($1, now() + interval '5 years')`, [babyId])).rejects.toThrow(/permission denied/)
    const inv = await invite(MOM)
    await expect(q(`update public.baby_invites set accepted_by = $1 where id = $2`, [STRANGER, inv.id])).rejects.toThrow(/permission denied/)
    await expect(q(`update public.baby_invites set expires_at = now() + interval '5 years' where id = $1`, [inv.id])).rejects.toThrow(/permission denied/)
  })

  it('only accepts an email written in lower case', async () => {
    await expect(invite(MOM, 'Dad@Example.com')).rejects.toThrow(/check/)
    await expect(invite(MOM, 'nope')).rejects.toThrow(/check/)
  })

  it('adds the person to the baby and marks the invite used', async () => {
    const inv = await invite(MOM)
    expect(await accept(STRANGER, inv.token, '  Aunt ')).toEqual({ status: 'ok', baby_id: babyId })
    await asUser(STRANGER)
    const [me] = await q(`select role, display_name from public.baby_members where user_id = $1`, [STRANGER])
    expect(me).toEqual({ role: 'parent', display_name: 'Aunt' })
    expect(await q(`select * from public.babies`)).toHaveLength(1)
    await as('postgres')
    const [used] = await q(`select accepted_by, accepted_at from public.baby_invites where id = $1`, [inv.id])
    expect(used.accepted_by).toBe(STRANGER)
    expect(used.accepted_at).not.toBeNull()
  })

  it('works only once for someone else, but opening it again as the same person is fine', async () => {
    const inv = await invite(MOM)
    expect((await accept(STRANGER, inv.token)).status).toBe('ok')
    expect((await accept(STRANGER, inv.token)).status).toBe('ok')
    // Granny is already a member through another route, so she isn't added twice.
    expect((await accept(GRANNY, inv.token)).status).toBe('already_member')
    await as('postgres')
    const [{ n }] = await q<{ n: number }>(`select count(*)::int as n from public.baby_members where baby_id = $1`, [babyId])
    expect(n).toBe(4)
  })

  it('does not let a used link add a second person', async () => {
    const outsider = '00000000-0000-0000-0000-0000000000a5'
    await as('postgres')
    await q(`insert into auth.users values ($1)`, [outsider])
    const inv = await invite(MOM)
    await accept(STRANGER, inv.token)
    EMAIL[outsider] = 'outsider@example.com'
    expect(await accept(outsider, inv.token)).toEqual({ status: 'invalid' })
    expect(await isMember(outsider)).toBe(false)
  })

  it('treats unknown, revoked and expired links the same way', async () => {
    expect(await accept(STRANGER, 'f'.repeat(32))).toEqual({ status: 'invalid' })

    const revoked = await invite(MOM)
    await asUser(MOM)
    await q(`update public.baby_invites set revoked_at = now() where id = $1`, [revoked.id])
    expect(await accept(STRANGER, revoked.token)).toEqual({ status: 'invalid' })

    const old = await invite(MOM)
    await as('postgres')
    await q(`update public.baby_invites set expires_at = now() - interval '1 minute' where id = $1`, [old.id])
    expect(await accept(STRANGER, old.token)).toEqual({ status: 'invalid' })

    expect(await isMember(STRANGER)).toBe(false)
  })

  it('with an email set, only that account can accept it (case-insensitively)', async () => {
    const inv = await invite(MOM, 'dad@example.com')
    const outsider = '00000000-0000-0000-0000-0000000000a6'
    await as('postgres')
    await q(`insert into auth.users values ($1)`, [outsider])
    EMAIL[outsider] = 'someone-else@example.com'
    expect(await accept(outsider, inv.token)).toEqual({ status: 'wrong_email' })
    expect(await isMember(outsider)).toBe(false)

    // The right account still can: the failed attempt didn't use the invite up.
    await as('postgres')
    await q(`update public.baby_members set removed_at = now() where user_id = $1`, [DAD])
    expect((await accept(DAD, inv.token, 'Dad')).status).toBe('ok')
    expect(await isMember(DAD)).toBe(true)
  })

  it('needs a display name', async () => {
    const inv = await invite(MOM)
    expect(await accept(STRANGER, inv.token, '   ')).toEqual({ status: 'invalid_name' })
    expect(await accept(STRANGER, inv.token, 'x'.repeat(41))).toEqual({ status: 'invalid_name' })
    expect(await isMember(STRANGER)).toBe(false)
  })

  it('can invite a viewer, who can read but not write', async () => {
    const inv = await invite(MOM, null, 'viewer')
    await accept(STRANGER, inv.token, 'Nanny')
    await asUser(STRANGER)
    expect(await q(`select * from public.babies`)).toHaveLength(1)
    await expect(logEvent(STRANGER)).rejects.toThrow(/row-level security/)
  })

  it('gives the new parent the whole log, and what they log is under their name', async () => {
    await logEvent(MOM, { note: 'first feed' })
    const inv = await invite(MOM)
    await accept(STRANGER, inv.token, 'Aunt')
    await asUser(STRANGER)
    expect(await q(`select * from public.baby_events`)).toHaveLength(1)
    const mine = await logEvent(STRANGER, { type: 'diaper', details: { kind: 'wet' } })
    expect(mine.logged_by).toBe(STRANGER)
  })

  it('is not callable without signing in', async () => {
    const inv = await invite(MOM)
    await as('anon')
    await expect(q(`select public.accept_baby_invite($1, 'x')`, [inv.token])).rejects.toThrow(/permission denied/)
  })

  it('lets a parent revoke, and nobody else', async () => {
    const inv = await invite(MOM)
    await asUser(GRANNY)
    await q(`update public.baby_invites set revoked_at = now() where id = $1`, [inv.id])
    await asUser(DAD)
    expect((await q(`select revoked_at from public.baby_invites where id = $1`, [inv.id]))[0].revoked_at).toBeNull()
    await q(`update public.baby_invites set revoked_at = now() where id = $1`, [inv.id])
    expect((await q(`select revoked_at from public.baby_invites where id = $1`, [inv.id]))[0].revoked_at).not.toBeNull()
  })
})

describe('members', () => {
  it('lets anyone rename themselves, but not change ids', async () => {
    await asUser(GRANNY)
    await q(`update public.baby_members set display_name = 'Nana' where user_id = $1`, [GRANNY])
    expect((await q(`select display_name from public.baby_members where user_id = $1`, [GRANNY]))[0].display_name).toBe('Nana')
    await expect(q(`update public.baby_members set user_id = $1 where user_id = $2`, [STRANGER, GRANNY])).rejects.toThrow(/permission denied/)
    await expect(q(`update public.baby_members set baby_id = gen_random_uuid() where user_id = $1`, [GRANNY])).rejects.toThrow(/permission denied/)
  })

  it('does not let a viewer make themselves a parent or remove anyone', async () => {
    await asUser(GRANNY)
    await expect(q(`update public.baby_members set role = 'parent' where user_id = $1`, [GRANNY])).rejects.toThrow(/Only a parent/)
    await expect(q(`update public.baby_members set removed_at = now() where user_id = $1`, [DAD])).resolves.toBeTruthy()
    expect(await isMember(DAD)).toBe(true)
  })

  it('lets a parent change a role or remove someone, and the removed person loses access', async () => {
    await logEvent(MOM)
    await asUser(MOM)
    await q(`update public.baby_members set role = 'parent' where user_id = $1`, [GRANNY])
    await q(`update public.baby_members set removed_at = now() where user_id = $1`, [DAD])
    await asUser(DAD)
    expect(await q(`select * from public.babies`)).toHaveLength(0)
    expect(await q(`select * from public.baby_events`)).toHaveLength(0)
    await expect(logEvent(DAD)).rejects.toThrow(/row-level security/)
    // Their name stays for the entries they logged.
    await asUser(MOM)
    expect((await q(`select display_name from public.baby_members where user_id = $1`, [DAD]))[0].display_name).toBe('Dad')
  })

  it('lets anyone leave, and leaving ends their access', async () => {
    await asUser(GRANNY)
    await q(`update public.baby_members set removed_at = now() where user_id = $1`, [GRANNY])
    expect(await q(`select * from public.babies`)).toHaveLength(0)
    expect(await isMember(GRANNY)).toBe(false)
  })

  it('does not let someone who left put themselves back', async () => {
    await asUser(DAD)
    await q(`update public.baby_members set removed_at = now() where user_id = $1`, [DAD])
    await q(`update public.baby_members set removed_at = null where user_id = $1`, [DAD])
    expect(await isMember(DAD)).toBe(false)
  })

  it('always keeps one parent', async () => {
    await as('postgres')
    await q(`update public.baby_members set removed_at = now() where user_id = $1`, [DAD])
    await asUser(MOM)
    await expect(q(`update public.baby_members set removed_at = now() where user_id = $1`, [MOM])).rejects.toThrow(/at least one parent/)
    await expect(q(`update public.baby_members set role = 'viewer' where user_id = $1`, [MOM])).rejects.toThrow(/at least one parent/)
    expect(await isMember(MOM)).toBe(true)
  })

  it('lets one of two parents leave', async () => {
    await asUser(DAD)
    await q(`update public.baby_members set removed_at = now() where user_id = $1`, [DAD])
    expect(await isMember(DAD)).toBe(false)
    expect(await isMember(MOM)).toBe(true)
  })

  it('cannot be added to or removed from the table directly', async () => {
    await asUser(MOM)
    await expect(
      q(`insert into public.baby_members (baby_id, user_id, role, display_name) values ($1, $2, 'parent', 'x')`, [babyId, STRANGER]),
    ).rejects.toThrow(/permission denied/)
    await expect(q(`delete from public.baby_members where user_id = $1`, [DAD])).rejects.toThrow(/permission denied/)
  })
})

describe('babies', () => {
  it('lets a parent edit the name, birth date and sex', async () => {
    await asUser(DAD)
    await q(`update public.babies set name = 'Noa M', birth_date = '2026-12-02', sex = 'female' where id = $1`, [babyId])
    expect((await q(`select name, birth_date::text as d from public.babies`))[0]).toEqual({ name: 'Noa M', d: '2026-12-02' })
  })

  it("won't let a viewer edit it, or anyone change who created it", async () => {
    await asUser(GRANNY)
    await q(`update public.babies set name = 'Hacked' where id = $1`, [babyId])
    await asUser(MOM)
    expect((await q(`select name from public.babies`))[0].name).toBe('Noa')
    await expect(q(`update public.babies set created_by = $1 where id = $2`, [DAD, babyId])).rejects.toThrow(/permission denied/)
  })

  it('cannot be removed from the app', async () => {
    await asUser(MOM)
    await expect(q(`delete from public.babies where id = $1`, [babyId])).rejects.toThrow(/permission denied/)
  })
})

describe('privileges', () => {
  it('keeps the membership helpers out of reach of anon and out of the Data API schema', async () => {
    await as('anon')
    await expect(q(`select private.is_baby_member($1)`, [babyId])).rejects.toThrow(/permission denied/)
    await as('postgres')
    // Only public is meant to be exposed; the helpers must not live there.
    expect(await q(`select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and proname like 'is_baby%'`)).toHaveLength(0)
  })

  it('leaves exactly two public functions, both closed to anon', async () => {
    await as('postgres')
    const fns = await q<{ proname: string; anon: boolean; auth: boolean }>(
      `select proname,
              has_function_privilege('anon', p.oid, 'execute') as anon,
              has_function_privilege('authenticated', p.oid, 'execute') as auth
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' order by proname`,
    )
    expect(fns).toEqual([
      { proname: 'accept_baby_invite', anon: false, auth: true },
      { proname: 'create_baby', anon: false, auth: true },
    ])
  })

  it('publishes entries for live updates', async () => {
    await as('postgres')
    const rows = await q(`select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by 1`)
    expect(rows).toEqual([{ tablename: 'baby_events' }])
  })

  it('has row level security on every table', async () => {
    await as('postgres')
    const rows = await q<{ relname: string; relrowsecurity: boolean }>(
      `select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relname like 'bab%' and relkind = 'r' order by 1`,
    )
    expect(rows.map(r => r.relname)).toEqual(['babies', 'baby_events', 'baby_invites', 'baby_members'])
    expect(rows.every(r => r.relrowsecurity)).toBe(true)
  })
})
