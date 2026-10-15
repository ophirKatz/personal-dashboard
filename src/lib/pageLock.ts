// Pure logic for the page lock (no React, no Supabase), so it can be unit-tested.
// This is a screen lock, not data security: the code is checked in the browser.
import { ALL_NAV_KEYS, NAV_ITEMS, isNavItemKey, type NavItemKey } from './navItems'

export const CODE_LENGTH = 4
export const DEFAULT_LOCK_CODE = '0000'
/** Locked until you change it in Settings. */
export const DEFAULT_LOCKED_PAGES: NavItemKey[] = ['wealth']
export const UNLOCK_PATH = '/unlock'

/** Leaving the app for longer than this locks every page again. */
export const AUTO_LOCK_AFTER_HIDDEN_MS = 60_000

export function isValidCode(code: unknown): code is string {
  return typeof code === 'string' && new RegExp(`^\\d{${CODE_LENGTH}}$`).test(code)
}

export function normalizeLockCode(raw: unknown): string {
  return isValidCode(raw) ? raw : DEFAULT_LOCK_CODE
}

/** Known page keys only, de-duplicated, in the app's canonical order. A missing value means "never configured". */
export function normalizeLockedPages(raw: unknown): NavItemKey[] {
  if (!Array.isArray(raw)) return DEFAULT_LOCKED_PAGES
  const keys = raw.filter((k): k is NavItemKey => typeof k === 'string' && isNavItemKey(k))
  return ALL_NAV_KEYS.filter(k => keys.includes(k))
}

/**
 * Canonical form of a location's pathname for lock matching. React Router
 * matches routes case-insensitively and decodes the path, so "/WEALTH",
 * "/%77ealth" and "//wealth/" all reach the Wealth page - the lock has to see
 * them as the same path or they'd walk straight past it.
 */
export function normalizePath(pathname: string): string {
  let path = pathname
  try {
    path = decodeURIComponent(pathname)
  } catch {
    // malformed escape: compare the raw path
  }
  path = path.toLowerCase().replace(/\/{2,}/g, '/')
  return path.length > 1 ? path.replace(/\/$/, '') : path
}

/** The lockable page a path belongs to ("/recipes/123" -> recipes), or null for Home, Settings, etc. */
export function pageKeyForPath(pathname: string): NavItemKey | null {
  const path = normalizePath(pathname)
  for (const key of ALL_NAV_KEYS) {
    const to = NAV_ITEMS[key].to
    if (path === to || path.startsWith(`${to}/`)) return key
  }
  return null
}

/** The page the path belongs to, but only if that page is currently locked. */
export function lockedKeyForPath(pathname: string, lockedPages: NavItemKey[]): NavItemKey | null {
  const key = pageKeyForPath(pathname)
  return key && lockedPages.includes(key) ? key : null
}

// ------------------------------------------------------------------ attempts

export type AttemptState = {
  failures: number
  /** Epoch ms until which attempts are refused; 0 = not locked out. */
  lockedUntil: number
}

export const NO_ATTEMPTS: AttemptState = { failures: 0, lockedUntil: 0 }
export const ATTEMPTS_PER_ROUND = 5
const BASE_COOLDOWN_MS = 30_000
const MAX_COOLDOWN_MS = 10 * 60_000

export function lockoutRemainingMs(state: AttemptState, now: number): number {
  return Math.max(0, state.lockedUntil - now)
}

/** Wrong guesses left before the next cooldown starts. */
export function attemptsLeft(state: AttemptState): number {
  return ATTEMPTS_PER_ROUND - (state.failures % ATTEMPTS_PER_ROUND)
}

/**
 * Every 5th wrong code in a row starts a cooldown that doubles each round
 * (30s, 1m, 2m ... capped at 10m), so guessing all 10,000 codes isn't practical.
 */
export function registerFailedAttempt(state: AttemptState, now: number): AttemptState {
  const failures = state.failures + 1
  if (failures % ATTEMPTS_PER_ROUND !== 0) return { failures, lockedUntil: state.lockedUntil }
  const round = failures / ATTEMPTS_PER_ROUND
  const cooldown = Math.min(BASE_COOLDOWN_MS * 2 ** (round - 1), MAX_COOLDOWN_MS)
  return { failures, lockedUntil: now + cooldown }
}

/** Tolerant of a missing or tampered stored value. */
export function parseAttemptState(raw: string | null): AttemptState {
  if (!raw) return NO_ATTEMPTS
  try {
    const parsed = JSON.parse(raw)
    const failures = Number(parsed?.failures)
    const lockedUntil = Number(parsed?.lockedUntil)
    if (!Number.isInteger(failures) || failures < 0 || !Number.isFinite(lockedUntil) || lockedUntil < 0) return NO_ATTEMPTS
    return { failures, lockedUntil }
  } catch {
    return NO_ATTEMPTS
  }
}

export function formatCooldown(ms: number): string {
  const seconds = Math.ceil(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`
}

/** True when the app was in the background long enough that pages should lock again. */
export function shouldRelockAfterHidden(hiddenAt: number | null, now: number): boolean {
  return hiddenAt !== null && now - hiddenAt >= AUTO_LOCK_AFTER_HIDDEN_MS
}
