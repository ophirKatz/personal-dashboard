import { useCallback, useEffect, useRef, useState } from 'react'
import { haptic } from '../../lib/haptics'
import { loadPvmProgress, setPvmGoalDone, toDoneSet } from './pvm'

/** A character's completed PvM goals (by goal key), with optimistic saves. */
export function usePvmProgress(userId: string, characterId: string) {
  const [done, setDone] = useState<ReadonlySet<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  // Saves run one after another so quick taps on the same goal can't land out of order.
  const saves = useRef<Promise<void>>(Promise.resolve())

  const load = useCallback(async () => {
    setLoading(true)
    setLoadFailed(false)
    try {
      setDone(toDoneSet(await loadPvmProgress(characterId)))
    } catch {
      setLoadFailed(true)
    }
    setLoading(false)
  }, [characterId])

  useEffect(() => { load() }, [load])

  const setGoal = useCallback((key: string, next: boolean) => {
    const apply = (value: boolean) => setDone(prev => {
      const s = new Set(prev)
      if (value) s.add(key)
      else s.delete(key)
      return s
    })
    haptic(next ? 'success' : 'light')
    apply(next)
    saves.current = saves.current
      .then(() => setPvmGoalDone(userId, characterId, key, next))
      .catch(async () => {
        setMessage('Could not save that change.')
        try {
          setDone(toDoneSet(await loadPvmProgress(characterId)))
        } catch {
          apply(!next)
        }
      })
  }, [userId, characterId])

  return { done, loading, loadFailed, message, dismissMessage: () => setMessage(null), reload: load, setGoal }
}
