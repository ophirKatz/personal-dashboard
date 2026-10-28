// Runs supabase/migrations/20261028_add_workout_tracking.sql against an in-process Postgres
// (PGlite) with just enough of Supabase's auth stubbed. The migration is applied to production
// only after review, so this is what proves the SQL runs and that the rules hold at the database.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import migration from '../../../supabase/migrations/20261028_add_workout_tracking.sql?raw'

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
  `)
  await db.exec(migration)
}, 30_000)

afterAll(() => db.close())

describe('workout_settings', () => {
  it('fills user_id from the signed-in user and defaults reminders off', async () => {
    await as('authenticated', owner)
    const [row] = await q(`insert into public.workout_settings (tracking_start_date) values ('2026-10-28') returning *`)
    expect(row).toMatchObject({ user_id: owner, reminder_enabled: false, reminder_times: [], last_reminder_slot: null })
  })

  it('allows one row per user', async () => {
    await as('authenticated', owner)
    await expect(q(`insert into public.workout_settings (tracking_start_date) values ('2026-10-29')`)).rejects.toThrow(/duplicate key/)
  })

  it('stores reminder times as times, round-tripping HH:MM', async () => {
    await as('authenticated', owner)
    await q(`update public.workout_settings set reminder_enabled = true, reminder_times = $1 where user_id = $2`, [['07:30', '21:00'], owner])
    const [row] = await q<{ reminder_times: string[] }>(`select reminder_times::text[] as reminder_times from public.workout_settings`)
    expect(row.reminder_times).toEqual(['07:30:00', '21:00:00'])
  })

  it('rejects a reminder time that is not a time', async () => {
    await as('authenticated', owner)
    await expect(q(`update public.workout_settings set reminder_times = $1 where user_id = $2`, [['25:99'], owner])).rejects.toThrow()
  })

  it('caps the number of reminders', async () => {
    await as('authenticated', owner)
    const seven = ['06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00']
    await expect(q(`update public.workout_settings set reminder_times = $1 where user_id = $2`, [seven, owner])).rejects.toThrow(/check/)
  })

  it('requires a tracking start date', async () => {
    await as('authenticated', other)
    await expect(q(`insert into public.workout_settings default values`)).rejects.toThrow(/not-null|null value/)
  })

  it("hides one user's settings from another and from anon", async () => {
    await as('authenticated', other)
    expect(await q(`select * from public.workout_settings`)).toHaveLength(0)
    await as('anon')
    expect(await q(`select * from public.workout_settings`)).toHaveLength(0)
  })

  it("won't let a user write a row for someone else", async () => {
    await as('authenticated', other)
    await expect(
      q(`insert into public.workout_settings (user_id, tracking_start_date) values ($1, '2026-10-28')`, [owner]),
    ).rejects.toThrow(/row-level security/)
  })

  it("won't let a user update someone else's row", async () => {
    await as('authenticated', other)
    await q(`update public.workout_settings set reminder_enabled = false where user_id = $1`, [owner])
    await as('postgres')
    const [row] = await q(`select reminder_enabled from public.workout_settings where user_id = $1`, [owner])
    expect(row.reminder_enabled).toBe(true)
  })

  it('is removed with its user', async () => {
    await as('postgres')
    await q(`delete from auth.users where id = $1`, [owner])
    expect(await q(`select * from public.workout_settings`)).toHaveLength(0)
  })
})
