import type { FocusSummaryPayload } from '../../supabase'

export function parseFocusSummary(raw: string | null): FocusSummaryPayload | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (parsed?.type === 'cards' && Array.isArray(parsed.cards)) return parsed as FocusSummaryPayload
    if (parsed?.type === 'text' && typeof parsed.text === 'string') return parsed as FocusSummaryPayload
  } catch {
    // Pre-cards rows stored plain text directly in `summary` — treat as text.
  }
  return { type: 'text', text: raw }
}
