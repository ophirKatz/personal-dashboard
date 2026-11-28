// Runs supabase/migrations/20261129_add_display_name.sql against an in-process Postgres (PGlite)
// with the parts of Supabase it touches stubbed: auth.users, and user_settings with its owner policy.
// The backfill depends on what is in the database when the migration is applied, so each case
// builds its own database in that state first.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import migration from '../../supabase/migrations/20261129_add_display_name.sql?raw'

const FIRST = '00000000-0000-0000-0000-0000000000f1'
const SECOND = '00000000-0000-0000-0000-0000000000f2'

const open: PGlite[] = []
afterAll(() => Promise.all(open.map(db => db.close())))

type Row = Record<string, any>
async function as(db: PGlite, role: 'anon' | 'authenticated' | 'postgres', uid = '') {
  await db.exec(`reset role; select set_config('test.uid', '${uid}', false);`)
  if (role !== 'postgres') await db.exec(`set role ${role}`)
}
const rows = async (db: PGlite, sql: string, params: unknown[] = []) => (await db.query<Row>(sql, params)).rows

/** A database shaped like production just before this migration, seeded by `seed`, then migrated. */
async function migrated(seed: (db: PGlite) => Promise<void> = async () => {}) {
  const db = new PGlite()
  open.push(db)
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    -- Supabase gives the API roles table access by default and relies on RLS to restrict it.
    grant usage on schema public, auth to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    create table auth.users (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now());
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    create table public.user_settings (
      user_id uuid primary key references auth.users(id) on delete cascade,
      updated_at timestamptz not null default now(),
      show_focus_section boolean not null default true
    );
    alter table public.user_settings enable row level security;
    create policy "user owns user_settings" on public.user_settings
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  `)
  await seed(db)
  await db.exec(migration)
  return db
}

const twoUsers = async (db: PGlite) => {
  await db.exec(`
    insert into auth.users (id, created_at) values ('${SECOND}', '2026-11-20'), ('${FIRST}', '2026-06-01');
  `)
}
const names = async (db: PGlite) =>
  Object.fromEntries((await rows(db, `select user_id, display_name from public.user_settings`)).map(r => [r.user_id, r.display_name]))

describe('backfill', () => {
  it('names only the first account, so a later account starts with no name', async () => {
    const db = await migrated(async db => {
      await twoUsers(db)
      await db.exec(`insert into public.user_settings (user_id) values ('${FIRST}'), ('${SECOND}')`)
    })
    expect(await names(db)).toEqual({ [FIRST]: 'Ophir', [SECOND]: null })
  })

  it('does not overwrite a name the first account already chose', async () => {
    const db = await migrated(async db => {
      await twoUsers(db)
      await db.exec(`insert into public.user_settings (user_id) values ('${FIRST}')`)
    })
    // The first account picks its own name; applying the backfill again must leave it alone.
    await db.exec(`update public.user_settings set display_name = 'Sam' where user_id = '${FIRST}'`)
    await db.exec(migration.slice(migration.indexOf('update public.user_settings')))
    expect(await names(db)).toEqual({ [FIRST]: 'Sam' })
  })

  it('creates nothing for an account that has no settings row yet', async () => {
    const db = await migrated(async db => {
      await twoUsers(db)
      await db.exec(`insert into public.user_settings (user_id) values ('${SECOND}')`)
    })
    expect(await names(db)).toEqual({ [SECOND]: null })
  })

  it('runs on an empty database', async () => {
    const db = await migrated()
    expect(await rows(db, `select * from public.user_settings`)).toEqual([])
  })
})

describe('display_name', () => {
  // One database for the whole block; the rows are reset before each case.
  let shared: PGlite
  beforeAll(async () => {
    shared = await migrated(twoUsers)
  }, 30_000)
  beforeEach(async () => {
    await as(shared, 'postgres')
    await shared.exec(`truncate public.user_settings`)
    await shared.exec(`insert into public.user_settings (user_id, display_name) values ('${FIRST}', 'Ophir')`)
  })
  const setUp = async () => shared

  it('is empty for a new account', async () => {
    const db = await setUp()
    await as(db, 'authenticated', SECOND)
    // The way the app saves any setting: insert, or update on conflict.
    await db.query(`insert into public.user_settings (user_id, show_focus_section) values ($1, false) on conflict (user_id) do update set show_focus_section = excluded.show_focus_section`, [SECOND])
    expect((await rows(db, `select display_name from public.user_settings`))[0].display_name).toBeNull()
  })

  it('can be set and cleared by its owner with the app\'s upsert', async () => {
    const db = await setUp()
    await as(db, 'authenticated', SECOND)
    const upsert = (name: string | null) =>
      db.query(`insert into public.user_settings (user_id, display_name) values ($1, $2) on conflict (user_id) do update set display_name = excluded.display_name`, [SECOND, name])
    await upsert('Dana')
    expect((await rows(db, `select display_name from public.user_settings`))[0].display_name).toBe('Dana')
    await upsert(null)
    expect((await rows(db, `select display_name from public.user_settings`))[0].display_name).toBeNull()
  })

  it('accepts a name of up to 40 characters and nothing blank or longer', async () => {
    const db = await setUp()
    await as(db, 'authenticated', FIRST)
    const set = (name: string) => db.query(`update public.user_settings set display_name = $1 where user_id = $2`, [name, FIRST])
    await expect(set('a'.repeat(40))).resolves.toBeTruthy()
    await expect(set('🌟'.repeat(40))).resolves.toBeTruthy()
    await expect(set('a'.repeat(41))).rejects.toThrow(/check/)
    await expect(set('')).rejects.toThrow(/check/)
    await expect(set('   ')).rejects.toThrow(/check/)
  })

  it("is private to its owner", async () => {
    const db = await setUp()
    await as(db, 'authenticated', SECOND)
    expect(await rows(db, `select display_name from public.user_settings`)).toHaveLength(0)
    await db.query(`update public.user_settings set display_name = 'Hijacked' where user_id = $1`, [FIRST])
    await as(db, 'postgres')
    expect((await rows(db, `select display_name from public.user_settings where user_id = $1`, [FIRST]))[0].display_name).toBe('Ophir')
    await as(db, 'anon')
    expect(await rows(db, `select * from public.user_settings`)).toHaveLength(0)
  })
})
