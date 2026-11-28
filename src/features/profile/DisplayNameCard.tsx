import { useEffect, useState } from 'react'
import { UserRound } from 'lucide-react'
import { Input } from '../../components/ui/input'
import { MAX_DISPLAY_NAME_LENGTH, normalizeDisplayName } from '../../lib/greeting'
import { getDisplayName, setDisplayName } from '../../lib/userSettings'

type Status = 'loading' | 'idle' | 'saving' | 'saved' | 'error' | 'load_error'

/** The name the home page greets you with. Saved when you leave the field; empty shows no name. */
export default function DisplayNameCard() {
  const [status, setStatus] = useState<Status>('loading')
  const [saved, setSaved] = useState('')
  const [value, setValue] = useState('')

  useEffect(() => {
    getDisplayName().then(
      name => {
        setSaved(name ?? '')
        setValue(name ?? '')
        setStatus('idle')
      },
      () => setStatus('load_error'),
    )
  }, [])

  async function commit() {
    const next = normalizeDisplayName(value) ?? ''
    setValue(next)
    if (next === saved) return
    setStatus('saving')
    try {
      await setDisplayName(next)
      setSaved(next)
      setStatus('saved')
    } catch {
      setStatus('error')
    }
  }

  // Until the stored name is known the field stays shut: typing then leaving it must not overwrite it.
  const editable = status !== 'loading' && status !== 'load_error'

  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-muted">
          <UserRound className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium">Your name</p>
          <p className="text-sm text-muted-foreground">Shown in the greeting on the home page. Leave it empty to show no name.</p>
        </div>
      </div>
      <Input
        aria-label="Your name"
        className="mt-4"
        placeholder="Your first name"
        autoComplete="given-name"
        maxLength={MAX_DISPLAY_NAME_LENGTH}
        disabled={!editable}
        value={value}
        onChange={e => {
          setValue(e.target.value)
          if (status === 'saved' || status === 'error') setStatus('idle')
        }}
        onBlur={commit}
        onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
      <p className="mt-2 min-h-5 text-sm" role="status">
        {status === 'saving' && <span className="text-muted-foreground">Saving…</span>}
        {status === 'saved' && <span className="text-muted-foreground">{saved ? 'Saved.' : 'Saved. No name will be shown.'}</span>}
        {status === 'error' && <span className="text-destructive">Couldn't save. Check your connection and try again.</span>}
        {status === 'load_error' && <span className="text-destructive">Couldn't load your name. Reload to try again.</span>}
      </p>
    </div>
  )
}
