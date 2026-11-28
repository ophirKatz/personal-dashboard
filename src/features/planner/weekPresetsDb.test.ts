// Runs supabase/migrations/20261128_add_week_planner.sql against an in-process Postgres (PGlite)
// with just enough of Supabase's auth stubbed. The migration is applied to production only after
// review, so this is what proves the SQL runs and that the rules hold at the database.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import migration from '../../../supabase/migrations/20261128_add_week_planner.sql?raw'

const db = new PGlite()

type Row = Record<string, unknown>
const q = async <T = Row>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows

type Role = 'anon' | 'authenticated' | 'postgres'
async function as(role: Role, uid = '') {
  await db.exec(`reset role; select set_config('test.uid', '${uid}', false);`)
  if (role !== 'postgres') await db.exec(`set role ${role}`)
}

const owner = '00000000-0000-0000-0000-00000000000a'
const other = '00000000-0000-0000-0000-00000000000b'

beforeAll(async () => {
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    grant usage on schema public, auth to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    insert into auth.users values ('${owner}'), ('${other}');
    -- the migration extends this existing table
    create table public.friends (id uuid primary key default gen_random_uuid(), name text not null);
    insert into public.friends (name) values ('Sam');
  `)
  await db.exec(migration)
}, 30_000)

afterAll(() => db.close())

describe('week_presets', () => {
  it('fills user_id from the signed-in user and starts with sensible defaults', async () => {
    await as('authenticated', owner)
    const [row] = await q(`insert into public.week_presets (title) values ('Climbing') returning *`)
    expect(row).toMatchObject({
      user_id: owner, emoji: '📅', title: 'Climbing', default_duration_minutes: 60,
      days: [], day_overrides: {}, invitees: [], position: 0,
    })
    const [{ t }] = await q<{ t: string }>(`select default_time::text as t from public.week_presets`)
    expect(t).toBe('18:00:00')
  })

  it('round-trips the usual days, per-day overrides and invitees', async () => {
    await as('authenticated', owner)
    const overrides = { '2': { time: '19:30', duration: 120 }, '6': { time: '10:00' } }
    const invitees = [{ email: 'sam@x.com', name: 'Sam' }, { email: 'dana@x.com' }]
    const [row] = await q<Row>(
      `insert into public.week_presets (title, default_time, days, day_overrides, invitees)
       values ('Date night', '20:00', $1, $2, $3) returning days, day_overrides, invitees, default_time::text as t`,
      [[2, 4], JSON.stringify(overrides), JSON.stringify(invitees)],
    )
    expect(row).toMatchObject({ days: [2, 4], day_overrides: overrides, invitees, t: '20:00:00' })
  })

  it('rejects a blank title', async () => {
    await as('authenticated', owner)
    await expect(q(`insert into public.week_presets (title) values ('   ')`)).rejects.toThrow(/check/)
    await expect(q(`insert into public.week_presets (title) values ($1)`, ['x'.repeat(201)])).rejects.toThrow(/check/)
  })

  it('keeps the duration within a day and at least five minutes', async () => {
    await as('authenticated', owner)
    await expect(q(`insert into public.week_presets (title, default_duration_minutes) values ('x', 4)`)).rejects.toThrow(/check/)
    await expect(q(`insert into public.week_presets (title, default_duration_minutes) values ('x', 1441)`)).rejects.toThrow(/check/)
    await q(`insert into public.week_presets (title, default_duration_minutes) values ('x', 1440)`)
  })

  it('only accepts weekdays 0 (Sunday) to 6 (Saturday)', async () => {
    await as('authenticated', owner)
    await expect(q(`insert into public.week_presets (title, days) values ('x', '{7}')`)).rejects.toThrow(/check/)
    await expect(q(`insert into public.week_presets (title, days) values ('x', '{-1}')`)).rejects.toThrow(/check/)
    await q(`insert into public.week_presets (title, days) values ('x', '{0,1,2,3,4,5,6}')`)
  })

  it('keeps overrides an object and invitees a bounded list', async () => {
    await as('authenticated', owner)
    await expect(q(`insert into public.week_presets (title, day_overrides) values ('x', '[]')`)).rejects.toThrow(/check/)
    await expect(q(`insert into public.week_presets (title, invitees) values ('x', '{}')`)).rejects.toThrow(/check/)
    const fiftyOne = JSON.stringify(Array.from({ length: 51 }, (_, i) => ({ email: `p${i}@x.com` })))
    await expect(q(`insert into public.week_presets (title, invitees) values ('x', $1)`, [fiftyOne])).rejects.toThrow(/check/)
  })

  it("hides one user's presets from another and from anon", async () => {
    await as('authenticated', other)
    expect(await q(`select * from public.week_presets`)).toHaveLength(0)
    await as('anon')
    expect(await q(`select * from public.week_presets`)).toHaveLength(0)
  })

  it("won't let a user write a preset for someone else", async () => {
    await as('authenticated', other)
    await expect(q(`insert into public.week_presets (user_id, title) values ($1, 'x')`, [owner])).rejects.toThrow(/row-level security/)
  })

  it("won't let a user change or delete someone else's preset", async () => {
    await as('authenticated', other)
    await q(`update public.week_presets set title = 'hijacked' where user_id = $1`, [owner])
    await q(`delete from public.week_presets where user_id = $1`, [owner])
    await as('postgres')
    const rows = await q<{ title: string }>(`select title from public.week_presets where user_id = $1 order by title`, [owner])
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.map(r => r.title)).not.toContain('hijacked')
  })

  it('is removed with its user', async () => {
    await as('postgres')
    await q(`delete from auth.users where id = $1`, [owner])
    expect(await q(`select * from public.week_presets`)).toHaveLength(0)
  })
})

describe('friends.email', () => {
  it('is an optional column that existing friends start without', async () => {
    await as('postgres')
    const [friend] = await q(`select name, email from public.friends`)
    expect(friend).toEqual({ name: 'Sam', email: null })
    await q(`update public.friends set email = 'sam@x.com' where name = 'Sam'`)
    const [updated] = await q(`select email from public.friends`)
    expect(updated.email).toBe('sam@x.com')
  })
})
