// Runs supabase/migrations/20261025_add_meal_shares.sql against an in-process
// Postgres (PGlite), with just enough of Supabase's auth / vault / pg_net
// stubbed. These are the rules that keep a public, no-login link safe, so they
// are tested at the database rather than only in the UI.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import migration from '../../../supabase/migrations/20261025_add_meal_shares.sql?raw'
import restrictNotifyMigration from '../../../supabase/migrations/20261025_restrict_notify_meal_pick_execute.sql?raw'

const db = new PGlite()

type Row = Record<string, unknown>
const q = async <T = Row>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows

type Role = 'anon' | 'authenticated' | 'postgres'
async function as(role: Role, uid = '') {
  await db.exec(`reset role; select set_config('test.uid', '${uid}', false);`)
  if (role !== 'postgres') await db.exec(`set role ${role}`)
}

// Fixtures, rebuilt before every test.
let owner: string, other: string, recipeId: string
let pasta: string, bowls: string, toast: string, plain: string, theirs: string
let dinner: Row, all: Row, expired: Row

async function meal(user: string, name: string, tags: string[], extra: { image?: string; recipe?: string; description?: string } = {}) {
  const [{ id }] = await q<{ id: string }>(
    `insert into public.meals (user_id, name, tags, description, image_url, recipe_id) values ($1,$2,$3,$4,$5,$6) returning id`,
    [user, name, tags, extra.description ?? null, extra.image ?? null, extra.recipe ?? null],
  )
  return id
}

async function share(user: string, tag: string, expiresAt?: string) {
  const [row] = await q(
    `insert into public.meal_shares (user_id, tag${expiresAt ? ', expires_at' : ''}) values ($1, $2${expiresAt ? ', $3' : ''}) returning *`,
    expiresAt ? [user, tag, expiresAt] : [user, tag],
  )
  return row
}

const getShare = async (token: string) => (await q<{ r: any }>(`select public.get_meal_share($1) as r`, [token]))[0].r
const pickMeal = async (token: string, mealId: string) => (await q<{ r: string }>(`select public.pick_meal_share($1, $2) as r`, [token, mealId]))[0].r
const row = async (id: unknown) => (await q(`select * from public.meal_shares where id = $1`, [id]))[0]
const calls = async () => { await as('postgres'); return q(`select * from net.calls order by id`) }

beforeAll(async () => {
  // Supabase stand-ins: API roles, auth.uid(), pg_net, vault.
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth; create schema net; create schema vault;
    create table auth.users (id uuid primary key default gen_random_uuid());
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    create table net.calls (id serial primary key, url text, headers jsonb, body jsonb);
    create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}')
      returns bigint language plpgsql as $$ begin insert into net.calls(url, headers, body) values (url, headers, body); return 1; end $$;
    create table vault.decrypted_secrets (name text, decrypted_secret text);
    insert into vault.decrypted_secrets values ('cron_secret', 's3cret');

    create table public.recipes (id uuid primary key default gen_random_uuid(), user_id uuid, title text, image_url text);
    create table public.meals (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references auth.users(id) on delete cascade,
      name text not null, description text, image_url text,
      recipe_id uuid references public.recipes(id) on delete set null,
      tags text[] not null default '{}' check (tags <@ array['breakfast','lunch','dinner','dessert']),
      created_at timestamptz not null default now());

    -- Supabase hands API roles table access and relies on RLS to restrict it, so
    -- "anon sees nothing" below has to come from RLS, not from a missing grant.
    grant usage on schema public, auth to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    -- ...and EXECUTE on every new function, directly (not via PUBLIC), which is why a
    -- plain "revoke ... from public" does not make a function private there.
    alter default privileges in schema public grant execute on functions to anon, authenticated;
  `)
  await db.exec(migration)
  await db.exec(restrictNotifyMigration)
}, 30_000)

afterAll(() => db.close())

beforeEach(async () => {
  await as('postgres')
  await db.exec(`truncate net.calls; truncate public.meal_shares, public.meals, public.recipes cascade; truncate auth.users cascade;`)
  ;[{ id: owner }] = await q<{ id: string }>(`insert into auth.users default values returning id`)
  ;[{ id: other }] = await q<{ id: string }>(`insert into auth.users default values returning id`)
  ;[{ id: recipeId }] = await q<{ id: string }>(`insert into public.recipes (user_id, title, image_url) values ($1, 'R', 'https://img/recipe.jpg') returning id`, [owner])
  pasta = await meal(owner, 'Pasta', ['dinner'], { description: 'Tomato', image: 'https://img/pasta.jpg', recipe: recipeId })
  bowls = await meal(owner, 'Bowls', ['lunch', 'dinner'], { recipe: recipeId }) // no own photo -> recipe photo
  toast = await meal(owner, 'Toast', ['breakfast'])
  plain = await meal(owner, 'Leftovers', []) // untagged
  theirs = await meal(other, 'Their dinner', ['dinner'])
  dinner = await share(owner, 'dinner')
  all = await share(owner, 'all')
  expired = await share(owner, 'all', new Date(Date.now() - 60_000).toISOString())
})

describe('meal_shares defaults', () => {
  it('generates a 32-character hex token (122 random bits) per link', () => {
    expect(dinner.token).toMatch(/^[0-9a-f]{32}$/)
    expect(dinner.token).not.toBe(all.token)
  })

  it('expires 24 hours after creation', () => {
    const ms = new Date(dinner.expires_at as string).getTime() - Date.now()
    expect(Math.abs(ms - 24 * 3600_000)).toBeLessThan(60_000)
  })

  it('rejects a tag that is not a meal type or "all"', async () => {
    await as('postgres')
    await expect(q(`insert into public.meal_shares (user_id, tag) values ($1, 'snack')`, [owner])).rejects.toThrow()
  })
})

describe('function privileges', () => {
  const canExecute = async (role: string, fn: string) =>
    (await q<{ ok: boolean }>(`select has_function_privilege($1, $2::regprocedure, 'execute') as ok`, [role, fn]))[0].ok

  it('the API roles can call the two public functions', async () => {
    await as('postgres')
    for (const role of ['anon', 'authenticated']) {
      expect(await canExecute(role, 'public.get_meal_share(text)')).toBe(true)
      expect(await canExecute(role, 'public.pick_meal_share(text, uuid)')).toBe(true)
    }
  })

  it('the API roles cannot execute the trigger function, even with Supabase-style default grants', async () => {
    await as('postgres')
    for (const role of ['anon', 'authenticated']) {
      expect(await canExecute(role, 'public.notify_meal_pick()')).toBe(false)
    }
  })

  it('the trigger function still runs when a pick fires it (it executes as its owner)', async () => {
    await as('anon')
    expect(await pickMeal(dinner.token as string, pasta)).toBe('ok')
    expect(await calls()).toHaveLength(1)
  })
})

describe('get_meal_share (public read)', () => {
  beforeEach(() => as('anon'))

  it("returns only the owner's meals that match the link's tag, ordered by name", async () => {
    const result = await getShare(dinner.token as string)
    expect(result.meals.map((m: Row) => m.name)).toEqual(['Bowls', 'Pasta'])
  })

  it('an "all" link returns every one of the owner\'s meals, including untagged ones, but never another user\'s', async () => {
    const result = await getShare(all.token as string)
    expect(result.meals.map((m: Row) => m.name)).toEqual(['Bowls', 'Leftovers', 'Pasta', 'Toast'])
  })

  it("a tagged link excludes untagged meals", async () => {
    const result = await getShare(dinner.token as string)
    expect(result.meals.map((m: Row) => m.name)).not.toContain('Leftovers')
  })

  it("uses the meal's own photo, else the linked recipe's photo, else null", async () => {
    const result = await getShare(all.token as string)
    const byName = Object.fromEntries(result.meals.map((m: Row) => [m.name, m.image_url]))
    expect(byName.Pasta).toBe('https://img/pasta.jpg')
    expect(byName.Bowls).toBe('https://img/recipe.jpg')
    expect(byName.Toast).toBeNull()
  })

  it('exposes only what the page renders - no user_id or recipe_id anywhere', async () => {
    const result = await getShare(all.token as string)
    expect(JSON.stringify(result)).not.toMatch(/user_id|recipe_id/)
    expect(Object.keys(result.meals[0]).sort()).toEqual(['description', 'id', 'image_url', 'name', 'tags'])
    expect(Object.keys(result).sort()).toEqual(['expires_at', 'meals', 'picked_meal_id', 'tag'])
  })

  it('reads meals live: adds, renames and deletes show up on the next call', async () => {
    await as('postgres')
    await q(`update public.meals set name = 'Penne' where id = $1`, [pasta])
    await q(`delete from public.meals where id = $1`, [bowls])
    await meal(owner, 'Fresh idea', ['dinner'])
    await as('anon')
    const result = await getShare(dinner.token as string)
    expect(result.meals.map((m: Row) => m.name)).toEqual(['Fresh idea', 'Penne'])
  })

  it('returns an empty list, not null, when the link has no matching meals', async () => {
    await as('postgres')
    const empty = await share(owner, 'dessert')
    await as('anon')
    expect((await getShare(empty.token as string)).meals).toEqual([])
  })

  it('returns null for an expired link', async () => {
    expect(await getShare(expired.token as string)).toBeNull()
  })

  it('returns null for an unknown token or empty string', async () => {
    expect(await getShare('nope')).toBeNull()
    expect(await getShare('')).toBeNull()
  })

  it('treats the token as a literal, not a pattern', async () => {
    expect(await getShare("' or '1'='1")).toBeNull()
    expect(await getShare('%')).toBeNull()
  })

  it('reports the tag, expiry and current pick', async () => {
    await pickMeal(dinner.token as string, pasta)
    const result = await getShare(dinner.token as string)
    expect(result.tag).toBe('dinner')
    expect(result.picked_meal_id).toBe(pasta)
    expect(new Date(result.expires_at).getTime()).toBe(new Date(dinner.expires_at as string).getTime())
  })

  it('works the same for a logged-in user (the owner opening their own link)', async () => {
    await as('authenticated', owner)
    expect((await getShare(dinner.token as string)).meals).toHaveLength(2)
  })
})

describe('meal_shares table access', () => {
  it('anon cannot list, update, delete or insert (RLS, not a missing grant)', async () => {
    await as('anon')
    expect(await q(`select * from public.meal_shares`)).toEqual([])
    expect((await db.query(`update public.meal_shares set expires_at = now() + interval '99 days'`)).affectedRows).toBe(0)
    expect((await db.query(`delete from public.meal_shares`)).affectedRows).toBe(0)
    await expect(db.query(`insert into public.meal_shares (user_id, tag) values ('${owner}', 'all')`)).rejects.toThrow()
    await as('postgres')
    expect(await row(dinner.id)).toBeDefined() // untouched
  })

  it('the owner sees and can revoke only their own links; revoking kills the link at once', async () => {
    await as('postgres')
    await share(other, 'all')
    await as('authenticated', owner)
    expect(await q(`select id from public.meal_shares`)).toHaveLength(3)
    expect((await db.query(`delete from public.meal_shares where id = $1`, [dinner.id])).affectedRows).toBe(1)
    await as('anon')
    expect(await getShare(dinner.token as string)).toBeNull()
  })

  it("another user can neither see, create-as-owner nor delete the owner's links", async () => {
    await as('authenticated', other)
    expect(await q(`select id from public.meal_shares where user_id = $1`, [owner])).toEqual([])
    await expect(db.query(`insert into public.meal_shares (user_id, tag) values ($1, 'all')`, [owner])).rejects.toThrow()
    expect((await db.query(`delete from public.meal_shares where id = $1`, [dinner.id])).affectedRows).toBe(0)
  })
})

describe('pick_meal_share (public write)', () => {
  beforeEach(() => as('anon'))

  it('records the pick and when it happened', async () => {
    expect(await pickMeal(dinner.token as string, pasta)).toBe('ok')
    await as('postgres')
    const saved = await row(dinner.id)
    expect(saved.picked_meal_id).toBe(pasta)
    expect(saved.picked_at).not.toBeNull()
  })

  it('lets her change her mind to another meal on the list', async () => {
    await pickMeal(dinner.token as string, pasta)
    expect(await pickMeal(dinner.token as string, bowls)).toBe('ok')
    await as('postgres')
    expect((await row(dinner.id)).picked_meal_id).toBe(bowls)
  })

  it('re-picking the same meal is ok and leaves the row untouched', async () => {
    await pickMeal(dinner.token as string, pasta)
    await as('postgres')
    const before = await row(dinner.id)
    await as('anon')
    expect(await pickMeal(dinner.token as string, pasta)).toBe('ok')
    await as('postgres')
    expect((await row(dinner.id)).picked_at).toEqual(before.picked_at)
  })

  it.each([
    ['a meal outside the link\'s tag', () => toast, 'invalid_meal'],
    ['an untagged meal on a tagged link', () => plain, 'invalid_meal'],
    ["another user's meal, even on an 'all' link", () => theirs, 'invalid_meal'],
    ['a meal id that does not exist', () => '00000000-0000-0000-0000-000000000000', 'invalid_meal'],
  ])('rejects %s and changes nothing', async (_label, mealId, expected) => {
    const token = (_label.includes("'all'") ? all : dinner).token as string
    expect(await pickMeal(token, mealId())).toBe(expected)
    await as('postgres')
    expect((await row(_label.includes("'all'") ? all.id : dinner.id)).picked_meal_id).toBeNull()
  })

  it('accepts an untagged meal on an "all" link', async () => {
    expect(await pickMeal(all.token as string, plain)).toBe('ok')
  })

  it("rejects an expired link, an unknown token and a revoked link as 'expired'", async () => {
    expect(await pickMeal(expired.token as string, pasta)).toBe('expired')
    expect(await pickMeal('nope', pasta)).toBe('expired')
    await as('postgres')
    await q(`delete from public.meal_shares where id = $1`, [dinner.id])
    await as('anon')
    expect(await pickMeal(dinner.token as string, pasta)).toBe('expired')
  })

  it('a link that expires after the page loaded stops accepting picks', async () => {
    await as('postgres')
    await q(`update public.meal_shares set expires_at = now() - interval '1 second' where id = $1`, [dinner.id])
    await as('anon')
    expect(await pickMeal(dinner.token as string, pasta)).toBe('expired')
  })
})

describe('pick notification trigger', () => {
  beforeEach(() => as('anon'))

  it('fires once per new pick, authenticated with the cron secret and carrying the share id', async () => {
    await pickMeal(dinner.token as string, pasta)
    const [call, ...rest] = await calls()
    expect(rest).toEqual([])
    expect(call.url).toMatch(/\/functions\/v1\/send-meal-pick-notification$/)
    expect(call.headers).toMatchObject({ Authorization: 'Bearer s3cret', 'Content-Type': 'application/json' })
    expect(call.body).toEqual({ share_id: dinner.id })
  })

  it('does not fire again when she re-picks the same meal', async () => {
    await pickMeal(dinner.token as string, pasta)
    await as('anon')
    await pickMeal(dinner.token as string, pasta)
    await pickMeal(dinner.token as string, pasta)
    expect(await calls()).toHaveLength(1)
  })

  it('fires again when she picks a different meal', async () => {
    await pickMeal(dinner.token as string, pasta)
    await as('anon')
    await pickMeal(dinner.token as string, bowls)
    expect(await calls()).toHaveLength(2)
  })

  it('never fires for a rejected pick', async () => {
    await pickMeal(dinner.token as string, toast)
    await pickMeal(dinner.token as string, theirs)
    await pickMeal(expired.token as string, pasta)
    await pickMeal('nope', pasta)
    expect(await calls()).toHaveLength(0)
  })

  it('does not fire when a pick is rewritten with the same meal (the trigger guards this itself)', async () => {
    await pickMeal(dinner.token as string, pasta)
    await as('authenticated', owner)
    await q(`update public.meal_shares set picked_meal_id = $1 where id = $2`, [pasta, dinner.id])
    expect(await calls()).toHaveLength(1)
  })

  it('does not fire when the owner changes other fields of the link', async () => {
    await pickMeal(dinner.token as string, pasta)
    await as('authenticated', owner)
    await q(`update public.meal_shares set expires_at = now() + interval '48 hours' where id = $1`, [dinner.id])
    expect(await calls()).toHaveLength(1)
  })

  it('does not fire when the pick is cleared, including when the picked meal is deleted', async () => {
    await pickMeal(dinner.token as string, pasta)
    await as('postgres')
    await q(`delete from public.meals where id = $1`, [pasta])
    expect((await row(dinner.id)).picked_meal_id).toBeNull()
    expect(await calls()).toHaveLength(1)
    await as('anon')
    expect((await getShare(dinner.token as string)).picked_meal_id).toBeNull()
  })

  it('a failing notification request does not fail or undo the pick', async () => {
    await as('postgres')
    await db.exec(`
      drop function net.http_post(text, jsonb, jsonb, jsonb);
      create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}')
        returns bigint language plpgsql as $$ begin raise exception 'pg_net is down'; end $$;
    `)
    await as('anon')
    expect(await pickMeal(dinner.token as string, pasta)).toBe('ok')
    await as('postgres')
    expect((await row(dinner.id)).picked_meal_id).toBe(pasta)
    // restore the recording stub for any later test
    await db.exec(`
      drop function net.http_post(text, jsonb, jsonb, jsonb);
      create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}')
        returns bigint language plpgsql as $$ begin insert into net.calls(url, headers, body) values (url, headers, body); return 1; end $$;
    `)
  })
})
