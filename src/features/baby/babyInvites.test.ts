import { describe, expect, it } from 'vitest'
import {
  inviteExpiryLabel,
  inviteTokenFromPath,
  inviteUrl,
  parseEmail,
  rememberPendingInvite,
  resolveAccept,
  takePendingInvite,
} from './babyInvites'

const TOKEN = 'a1b2c3d4e5f60718293a4b5c6d7e8f90'

function memoryStore() {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  }
}

describe('inviteUrl / inviteTokenFromPath', () => {
  it('round-trips a token through the link', () => {
    const url = inviteUrl('https://app.example.com', TOKEN)
    expect(url).toBe(`https://app.example.com/baby/join/${TOKEN}`)
    expect(inviteTokenFromPath(new URL(url).pathname)).toBe(TOKEN)
  })

  it('accepts a trailing slash and any letter case in the prefix', () => {
    expect(inviteTokenFromPath(`/baby/join/${TOKEN}/`)).toBe(TOKEN)
    expect(inviteTokenFromPath(`/Baby/Join/${TOKEN}`)).toBe(TOKEN)
  })

  it('ignores other paths and implausible tokens', () => {
    expect(inviteTokenFromPath('/baby')).toBeNull()
    expect(inviteTokenFromPath('/baby/join/')).toBeNull()
    expect(inviteTokenFromPath('/baby/join/short')).toBeNull()
    expect(inviteTokenFromPath(`/baby/join/${TOKEN}/extra`)).toBeNull()
    expect(inviteTokenFromPath(`/pick/${TOKEN}`)).toBeNull()
    expect(inviteTokenFromPath(`/baby/join/${'a'.repeat(65)}`)).toBeNull()
    expect(inviteTokenFromPath(`/baby/join/${TOKEN}%00`)).toBeNull()
  })
})

describe('parseEmail', () => {
  it('treats blank as "not tied to an address"', () => {
    expect(parseEmail('')).toEqual({ ok: true, email: null })
    expect(parseEmail('   ')).toEqual({ ok: true, email: null })
  })

  it('trims and lower-cases an address', () => {
    expect(parseEmail('  Dad@Example.COM ')).toEqual({ ok: true, email: 'dad@example.com' })
  })

  it('rejects things that cannot be an address', () => {
    for (const bad of ['dad', 'dad@', '@example.com', 'dad@example', 'a b@example.com', 'a@b@example.com']) {
      expect(parseEmail(bad)).toEqual({ ok: false })
    }
  })
})

describe('inviteExpiryLabel', () => {
  const now = Date.UTC(2026, 10, 28, 12, 0, 0)
  const at = (ms: number) => new Date(now + ms).toISOString()

  it('counts down in days, hours and minutes', () => {
    expect(inviteExpiryLabel(at(7 * 24 * 3600_000), now)).toBe('7d left')
    expect(inviteExpiryLabel(at(30 * 3600_000), now)).toBe('1d left')
    expect(inviteExpiryLabel(at(5 * 3600_000), now)).toBe('5h left')
    expect(inviteExpiryLabel(at(20 * 60_000), now)).toBe('20m left')
  })

  it('rounds up so a live link never reads zero, and says expired once it is', () => {
    expect(inviteExpiryLabel(at(1_000), now)).toBe('1m left')
    expect(inviteExpiryLabel(at(0), now)).toBe('expired')
    expect(inviteExpiryLabel(at(-5_000), now)).toBe('expired')
  })
})

describe('resolveAccept', () => {
  const baby = '11111111-1111-1111-1111-111111111111'

  it('reads the database answers', () => {
    expect(resolveAccept({ status: 'ok', baby_id: baby }, null)).toEqual({ status: 'joined', babyId: baby })
    expect(resolveAccept({ status: 'already_member', baby_id: baby }, null)).toEqual({ status: 'already_member', babyId: baby })
    expect(resolveAccept({ status: 'invalid' }, null)).toEqual({ status: 'invalid' })
    expect(resolveAccept({ status: 'wrong_email' }, null)).toEqual({ status: 'wrong_email' })
    expect(resolveAccept({ status: 'invalid_name' }, null)).toEqual({ status: 'invalid_name' })
  })

  it('never reports success for a failed or unrecognised answer', () => {
    expect(resolveAccept(null, { message: 'network' })).toEqual({ status: 'error' })
    expect(resolveAccept({ status: 'ok', baby_id: baby }, new Error('x'))).toEqual({ status: 'error' })
    expect(resolveAccept(null, null)).toEqual({ status: 'error' })
    expect(resolveAccept('ok', null)).toEqual({ status: 'error' })
    expect(resolveAccept({ status: 'ok' }, null)).toEqual({ status: 'error' })
    expect(resolveAccept({ status: 'ok', baby_id: 5 }, null)).toEqual({ status: 'error' })
    expect(resolveAccept({ status: 'maybe' }, null)).toEqual({ status: 'error' })
  })
})

describe('pending invite across the sign-in redirect', () => {
  it('remembers a token and hands it back once', () => {
    const store = memoryStore()
    rememberPendingInvite(TOKEN, store, 1_000)
    expect(takePendingInvite(store, 2_000)).toBe(TOKEN)
    expect(takePendingInvite(store, 2_000)).toBeNull()
  })

  it('forgets a token after an hour', () => {
    const store = memoryStore()
    rememberPendingInvite(TOKEN, store, 0)
    expect(takePendingInvite(store, 60 * 60_000 + 1)).toBeNull()
    expect(store.data.size).toBe(0)
  })

  it('ignores garbage in storage', () => {
    const store = memoryStore()
    store.setItem('baby-pending-invite', 'not json')
    expect(takePendingInvite(store)).toBeNull()
    store.setItem('baby-pending-invite', JSON.stringify({ token: '../../etc', at: Date.now() }))
    expect(takePendingInvite(store)).toBeNull()
    store.setItem('baby-pending-invite', JSON.stringify({ token: TOKEN }))
    expect(takePendingInvite(store)).toBeNull()
  })

  it('does nothing without storage', () => {
    expect(() => rememberPendingInvite(TOKEN, null)).not.toThrow()
    expect(takePendingInvite(null)).toBeNull()
  })

  it('survives storage that throws', () => {
    const broken = {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
      removeItem: () => { throw new Error('blocked') },
    }
    expect(() => rememberPendingInvite(TOKEN, broken)).not.toThrow()
    expect(takePendingInvite(broken)).toBeNull()
  })
})
