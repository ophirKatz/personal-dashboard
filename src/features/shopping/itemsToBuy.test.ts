import { describe, expect, it, vi } from 'vitest'

vi.mock('../../supabase', () => ({ supabase: { from: vi.fn() } }))

const { itemsToBuyLabel } = await import('./itemsToBuy')

describe('itemsToBuyLabel', () => {
  it('handles zero, one and many', () => {
    expect(itemsToBuyLabel(0)).toBe('Nothing to buy')
    expect(itemsToBuyLabel(1)).toBe('1 item to buy')
    expect(itemsToBuyLabel(12)).toBe('12 items to buy')
  })
})
