// Runs the distance migration on top of the home-workout schema in an in-process Postgres (PGlite)
// with Supabase's auth stubbed, to prove the SQL applies and that existing rows are unaffected.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import homeWorkout from '../../../supabase/migrations/20261002_add_home_workout.sql?raw'
import distance from '../../../supabase/migrations/20261117_add_workout_distance.sql?raw'

const db = new PGlite()

type Row = Record<string, unknown>
const q = async <T = Row>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows

const owner = '00000000-0000-0000-0000-00000000000a'
let logId: string
let presetId: string
let exerciseId: string

beforeAll(async () => {
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    insert into auth.users values ('${owner}');
  `)
  await db.exec(homeWorkout)
  // A row written before the distance migration exists.
  const [ex] = await q<{ id: string }>(`insert into public.workout_exercises (user_id, name, builtin_key) values ($1, 'Push ups', 'push_ups') returning id`, [owner])
  exerciseId = ex.id
  const [log] = await q<{ id: string }>(`insert into public.workout_logs (user_id) values ($1) returning id`, [owner])
  logId = log.id
  const [preset] = await q<{ id: string }>(`insert into public.workout_presets (user_id, name) values ($1, 'Home') returning id`, [owner])
  presetId = preset.id
  await q(`insert into public.workout_log_exercises (user_id, log_id, exercise_name, sets, reps) values ($1, $2, 'Push ups', 3, 15)`, [owner, logId])
  await db.exec(distance)
}, 30_000)

afterAll(() => db.close())

describe('distance_km', () => {
  it('leaves existing sets x reps rows with no distance', async () => {
    const [row] = await q(`select sets, reps, distance_km from public.workout_log_exercises`)
    expect(row).toEqual({ sets: 3, reps: 15, distance_km: null })
  })

  it('is optional, so a sets x reps item can still be written without it', async () => {
    await q(`insert into public.workout_log_exercises (user_id, log_id, exercise_name, sets, reps) values ($1, $2, 'Squats', 4, 10)`, [owner, logId])
    await q(`insert into public.workout_preset_exercises (user_id, preset_id, exercise_id, sets, reps) values ($1, $2, $3, 3, 10)`, [owner, presetId, exerciseId])
  })

  it('stores kilometres with up to two decimals on logs and presets', async () => {
    await q(`insert into public.workout_log_exercises (user_id, log_id, exercise_name, sets, reps, distance_km) values ($1, $2, 'Running', 1, 1, 5.25)`, [owner, logId])
    await q(`insert into public.workout_preset_exercises (user_id, preset_id, exercise_id, sets, reps, distance_km) values ($1, $2, $3, 1, 1, 3)`, [owner, presetId, exerciseId])
    const [row] = await q<{ distance_km: string }>(`select distance_km::text from public.workout_log_exercises where exercise_name = 'Running'`)
    expect(row.distance_km).toBe('5.25')
  })

  it('rejects a zero or negative distance', async () => {
    await expect(q(`insert into public.workout_log_exercises (user_id, log_id, exercise_name, distance_km) values ($1, $2, 'Running', 0)`, [owner, logId])).rejects.toThrow(/check/)
    await expect(q(`insert into public.workout_preset_exercises (user_id, preset_id, exercise_id, distance_km) values ($1, $2, $3, -1)`, [owner, presetId, exerciseId])).rejects.toThrow(/check/)
  })
})
