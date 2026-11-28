// Pure helpers for inviting someone to a baby tracker: the link, the email check, reading the
// join result, and remembering a link across the sign-in redirect. No React, no Supabase.

const JOIN_PATH = /^\/baby\/join\/([A-Za-z0-9_-]{16,64})\/?$/i

export function inviteUrl(origin: string, token: string): string {
  return `${origin}/baby/join/${token}`
}

/** The invite token in a /baby/join/:token path, or null for any other path. */
export function inviteTokenFromPath(pathname: string): string | null {
  return JOIN_PATH.exec(pathname)?.[1] ?? null
}

export type EmailInput = { ok: true; email: string | null } | { ok: false }

/** Blank means "not tied to an address". Otherwise the address, lower-cased, or not ok if it can't be one. */
export function parseEmail(raw: string): EmailInput {
  const email = raw.trim().toLowerCase()
  if (!email) return { ok: true, email: null }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? { ok: true, email } : { ok: false }
}

/** "6d left", "5h left", "20m left" or "expired". Rounds up, so a live link never reads "0m left". */
export function inviteExpiryLabel(expiresAt: string, now: number): string {
  const ms = new Date(expiresAt).getTime() - now
  if (ms <= 0) return 'expired'
  const minutes = Math.ceil(ms / 60_000)
  if (minutes < 60) return `${minutes}m left`
  const hours = Math.ceil(minutes / 60)
  if (hours < 24) return `${hours}h left`
  return `${Math.floor(hours / 24)}d left`
}

export type AcceptOutcome =
  | { status: 'joined'; babyId: string }
  /** The person is already in this tracker. */
  | { status: 'already_member'; babyId: string }
  /** Unknown, used, revoked or expired. */
  | { status: 'invalid' }
  /** The invite is tied to a different email address. */
  | { status: 'wrong_email' }
  | { status: 'invalid_name' }
  /** The request failed or the answer was unexpected; worth retrying. */
  | { status: 'error' }

/** Interprets accept_baby_invite's response. Anything unrecognised is an error, never a success. */
export function resolveAccept(data: unknown, error: unknown): AcceptOutcome {
  if (error) return { status: 'error' }
  if (typeof data !== 'object' || data === null) return { status: 'error' }
  const { status, baby_id: babyId } = data as { status?: unknown; baby_id?: unknown }
  if ((status === 'ok' || status === 'already_member') && typeof babyId === 'string') {
    return { status: status === 'ok' ? 'joined' : 'already_member', babyId }
  }
  if (status === 'invalid' || status === 'wrong_email' || status === 'invalid_name') return { status }
  return { status: 'error' }
}

// The Google sign-in sends the browser away and back to the home page, so an invite link opened
// while signed out has to be remembered to carry on once the person is signed in.
const PENDING_KEY = 'baby-pending-invite'
const PENDING_TTL_MS = 60 * 60_000

type KeyValueStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function defaultStore(): KeyValueStore | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

export function rememberPendingInvite(token: string, store: KeyValueStore | null = defaultStore(), now = Date.now()): void {
  try {
    store?.setItem(PENDING_KEY, JSON.stringify({ token, at: now }))
  } catch {
    // Storage can be blocked (private windows); the person just opens the link again.
  }
}

/** The remembered invite token, once: it is forgotten as it is read, and stale ones are ignored. */
export function takePendingInvite(store: KeyValueStore | null = defaultStore(), now = Date.now()): string | null {
  try {
    const raw = store?.getItem(PENDING_KEY)
    if (!raw) return null
    store?.removeItem(PENDING_KEY)
    const { token, at } = JSON.parse(raw) as { token?: unknown; at?: unknown }
    if (typeof token !== 'string' || typeof at !== 'number' || now - at > PENDING_TTL_MS) return null
    return JOIN_PATH.test(`/baby/join/${token}`) ? token : null
  } catch {
    return null
  }
}
