import { useEffect, useState } from 'react'
import { supabase } from '../../supabase'
import { ACTIVE_CHARACTER_KEY } from './goals'

export type ActiveCharacter =
  | { state: 'loading' | 'unavailable' | 'error' }
  | { state: 'ready'; userId: string; characterId: string; characterName: string }

/** The character the RuneScape page is showing: the remembered one, else the first. */
async function loadActiveCharacter(): Promise<ActiveCharacter> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { state: 'unavailable' }
  const { data, error } = await supabase.from('rs_characters').select('id, name').order('created_at')
  if (error) return { state: 'error' }
  if (data.length === 0) return { state: 'unavailable' }

  let remembered: string | null = null
  try { remembered = localStorage.getItem(ACTIVE_CHARACTER_KEY) } catch { /* storage unavailable */ }
  const active = data.find(c => c.id === remembered) ?? data[0]
  return { state: 'ready', userId: user.id, characterId: active.id, characterName: active.name }
}

/** Loads the active character for RuneScape sub-pages; `retry` reloads after an error. */
export function useActiveCharacter() {
  const [load, setLoad] = useState<ActiveCharacter>({ state: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoad({ state: 'loading' })
    loadActiveCharacter()
      .then(s => { if (!cancelled) setLoad(s) })
      .catch(() => { if (!cancelled) setLoad({ state: 'error' }) })
    return () => { cancelled = true }
  }, [attempt])

  return { load, retry: () => setAttempt(a => a + 1) }
}
