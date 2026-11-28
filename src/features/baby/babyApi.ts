// Everything the baby tracker says to Supabase. Row access is decided by the database (see
// supabase/migrations/20261128_add_baby_tracker.sql), not here: these calls just ask.
import { supabase } from '../../supabase'
import { resolveAccept, type AcceptOutcome } from './babyInvites'
import type { Baby, BabyEvent, BabyInvite, BabyMember, BabyRole, EventDraft } from './babyEvents'

export type MyBaby = { baby: Baby; role: BabyRole; displayName: string }

const BABY_COLUMNS = 'id, name, birth_date, sex'
const EVENT_COLUMNS =
  'id, baby_id, type, started_at, ended_at, in_progress, details, note, logged_by, updated_by, created_at, updated_at, deleted_at'
const MEMBER_COLUMNS = 'baby_id, user_id, role, display_name, created_at, removed_at'
const INVITE_COLUMNS = 'id, baby_id, token, role, invited_email, expires_at, accepted_at, revoked_at, created_at'

/** Most entries one load asks for: a few weeks of a newborn's log is a few hundred rows. */
const EVENT_LIMIT = 2000

function uniqueViolation(error: unknown, constraint: RegExp): boolean {
  const { code, message } = (error ?? {}) as { code?: string; message?: string }
  return code === '23505' && constraint.test(message ?? '')
}

/** Two phones tried to start the same kind of timer at once; the first one won. */
export function isTimerConflict(error: unknown): boolean {
  return uniqueViolation(error, /baby_events_one_running/)
}

/** This entry was already saved (a retry of a request that did arrive). */
export function isDuplicateId(error: unknown): boolean {
  return uniqueViolation(error, /baby_events_pkey/)
}

// --- Babies and members ---------------------------------------------------------------------

/** The babies this person is currently in, oldest first. */
export async function loadMyBabies(userId: string): Promise<MyBaby[]> {
  const { data, error } = await supabase
    .from('baby_members')
    .select(`role, display_name, baby:babies(${BABY_COLUMNS})`)
    .eq('user_id', userId)
    .is('removed_at', null)
    .order('created_at')
  if (error) throw error
  return (data ?? []).flatMap(row => {
    const baby = (Array.isArray(row.baby) ? row.baby[0] : row.baby) as Baby | undefined
    return baby ? [{ baby, role: row.role as BabyRole, displayName: row.display_name as string }] : []
  })
}

export async function createBaby(input: { name: string; birthDate: string | null; displayName: string }): Promise<string> {
  const { data, error } = await supabase.rpc('create_baby', {
    p_name: input.name,
    p_birth_date: input.birthDate,
    p_sex: null,
    p_display_name: input.displayName,
  })
  if (error) throw error
  return data as string
}

export async function updateBaby(id: string, patch: { name?: string; birth_date?: string | null }): Promise<Baby> {
  const { data, error } = await supabase.from('babies').update(patch).eq('id', id).select(BABY_COLUMNS).single()
  if (error) throw error
  return data as Baby
}

/** Everyone who has ever been in the tracker, including people who left (their name stays on their entries). */
export async function loadMembers(babyId: string): Promise<BabyMember[]> {
  const { data, error } = await supabase.from('baby_members').select(MEMBER_COLUMNS).eq('baby_id', babyId).order('created_at')
  if (error) throw error
  return (data ?? []) as BabyMember[]
}

export async function renameMember(babyId: string, userId: string, displayName: string): Promise<void> {
  const { error } = await supabase.from('baby_members').update({ display_name: displayName }).eq('baby_id', babyId).eq('user_id', userId)
  if (error) throw error
}

/** Leaving, or removing someone else. The row stays, so older entries keep their author's name. */
export async function removeMember(babyId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('baby_members')
    .update({ removed_at: new Date().toISOString() })
    .eq('baby_id', babyId)
    .eq('user_id', userId)
  if (error) throw error
}

// --- Entries --------------------------------------------------------------------------------

export async function loadEvents(babyId: string, sinceIso: string): Promise<BabyEvent[]> {
  const { data, error } = await supabase
    .from('baby_events')
    .select(EVENT_COLUMNS)
    .eq('baby_id', babyId)
    .is('deleted_at', null)
    .gte('started_at', sinceIso)
    .order('started_at', { ascending: false })
    .limit(EVENT_LIMIT)
  if (error) throw error
  return (data ?? []) as BabyEvent[]
}

/** Timers still running, however long ago they started (a sleep nobody stopped). */
export async function loadRunningEvents(babyId: string): Promise<BabyEvent[]> {
  const { data, error } = await supabase
    .from('baby_events')
    .select(EVENT_COLUMNS)
    .eq('baby_id', babyId)
    .eq('in_progress', true)
    .is('deleted_at', null)
  if (error) throw error
  return (data ?? []) as BabyEvent[]
}

export async function insertEvent(event: BabyEvent): Promise<BabyEvent> {
  const { data, error } = await supabase
    .from('baby_events')
    .insert({
      id: event.id,
      baby_id: event.baby_id,
      type: event.type,
      started_at: event.started_at,
      ended_at: event.ended_at,
      in_progress: event.in_progress,
      details: event.details,
      note: event.note,
      logged_by: event.logged_by,
    })
    .select(EVENT_COLUMNS)
    .single()
  if (error) throw error
  return data as BabyEvent
}

export type EventPatch = Partial<EventDraft> & { deleted_at?: string | null }

export async function updateEvent(id: string, patch: EventPatch): Promise<BabyEvent> {
  const { data, error } = await supabase.from('baby_events').update(patch).eq('id', id).select(EVENT_COLUMNS).single()
  if (error) throw error
  return data as BabyEvent
}

// --- Invites --------------------------------------------------------------------------------

/** Links that could still be used. */
export async function loadInvites(babyId: string): Promise<BabyInvite[]> {
  const { data, error } = await supabase
    .from('baby_invites')
    .select(INVITE_COLUMNS)
    .eq('baby_id', babyId)
    .is('accepted_at', null)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as BabyInvite[]
}

export async function createInvite(babyId: string, email: string | null): Promise<BabyInvite> {
  const { data, error } = await supabase
    .from('baby_invites')
    .insert({ baby_id: babyId, invited_email: email, role: 'parent' })
    .select(INVITE_COLUMNS)
    .single()
  if (error) throw error
  return data as BabyInvite
}

export async function revokeInvite(id: string): Promise<void> {
  const { error } = await supabase.from('baby_invites').update({ revoked_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function acceptInvite(token: string, displayName: string): Promise<AcceptOutcome> {
  const { data, error } = await supabase.rpc('accept_baby_invite', { p_token: token, p_display_name: displayName })
  return resolveAccept(data, error)
}

export function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
    return (error as { message: string }).message
  }
  return 'Something went wrong.'
}
