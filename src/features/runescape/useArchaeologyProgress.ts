import { useCallback, useEffect, useRef, useState } from 'react'
import { haptic } from '../../lib/haptics'
import { loadArchaeologyProgress, setArtefactFound, toFoundMap, type FoundMap } from './archaeology'

/** A character's saved Archaeology progress (artefact counts and solved mysteries), with optimistic saves. */
export function useArchaeologyProgress(userId: string, characterId: string) {
  const [found, setFound] = useState<FoundMap>({})
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const latest = useRef(found)
  latest.current = found
  // Saves run one after another so quick taps on the same item can't land out of order.
  const saves = useRef<Promise<void>>(Promise.resolve())

  const load = useCallback(async () => {
    setLoading(true)
    setLoadFailed(false)
    try {
      setFound(toFoundMap(await loadArchaeologyProgress(characterId)))
    } catch {
      setLoadFailed(true)
    }
    setLoading(false)
  }, [characterId])

  useEffect(() => { load() }, [load])

  const setCount = useCallback((key: string, next: number) => {
    const prev = latest.current[key] ?? 0
    haptic()
    setFound(f => ({ ...f, [key]: next }))
    saves.current = saves.current
      .then(() => setArtefactFound(userId, characterId, key, next))
      .catch(async () => {
        setMessage('Could not save that change.')
        try {
          setFound(toFoundMap(await loadArchaeologyProgress(characterId)))
        } catch {
          setFound(f => ({ ...f, [key]: prev }))
        }
      })
  }, [userId, characterId])

  return { found, loading, loadFailed, message, dismissMessage: () => setMessage(null), reload: load, setCount }
}
