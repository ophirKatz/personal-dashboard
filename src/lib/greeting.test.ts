import { describe, expect, it } from 'vitest'
import { MAX_DISPLAY_NAME_LENGTH, greetingText, normalizeDisplayName } from './greeting'

describe('greetingText', () => {
  it('greets by name', () => {
    expect(greetingText('Sam', 8)).toBe('Good morning, Sam 👋')
    expect(greetingText('Sam', 14)).toBe('Good afternoon, Sam 👋')
    expect(greetingText('Sam', 20)).toBe('Good evening, Sam 👋')
  })

  it('shows no name, and no stray comma, when none is set', () => {
    for (const none of [null, undefined, '', '   ']) {
      expect(greetingText(none, 8)).toBe('Good morning 👋')
    }
    expect(greetingText(null, 20)).toBe('Good evening 👋')
  })

  it('changes at noon and at five', () => {
    expect(greetingText('Sam', 0)).toContain('morning')
    expect(greetingText('Sam', 11)).toContain('morning')
    expect(greetingText('Sam', 12)).toContain('afternoon')
    expect(greetingText('Sam', 16)).toContain('afternoon')
    expect(greetingText('Sam', 17)).toContain('evening')
    expect(greetingText('Sam', 23)).toContain('evening')
  })

  it('tidies the name it is given', () => {
    expect(greetingText('  Sam   Lee ', 8)).toBe('Good morning, Sam Lee 👋')
  })
})

describe('normalizeDisplayName', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeDisplayName('  Dana ')).toBe('Dana')
    expect(normalizeDisplayName('Mary\t  Ann\n')).toBe('Mary Ann')
  })

  it('turns blank and non-text into "no name"', () => {
    expect(normalizeDisplayName('')).toBeNull()
    expect(normalizeDisplayName(' \n\t ')).toBeNull()
    expect(normalizeDisplayName(null)).toBeNull()
    expect(normalizeDisplayName(undefined)).toBeNull()
    expect(normalizeDisplayName(42)).toBeNull()
  })

  it('keeps names in other scripts and with emoji', () => {
    expect(normalizeDisplayName('דנה')).toBe('דנה')
    expect(normalizeDisplayName('Zoë 🌟')).toBe('Zoë 🌟')
  })

  it('cuts to the length the database allows, without splitting an emoji', () => {
    expect(normalizeDisplayName('a'.repeat(60))).toBe('a'.repeat(MAX_DISPLAY_NAME_LENGTH))
    const long = '🌟'.repeat(50)
    expect(normalizeDisplayName(long)).toBe('🌟'.repeat(MAX_DISPLAY_NAME_LENGTH))
  })
})
