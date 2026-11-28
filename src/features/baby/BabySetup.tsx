import { useState } from 'react'
import { Baby as BabyIcon } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { haptic } from '../../lib/haptics'
import { createBaby, errorMessage } from './babyApi'

type Props = {
  /** Prefilled from the Google account's first name, if there is one. */
  suggestedName: string
  onCreated: () => void
}

/** First-run screen: set up a tracker, or be told to open an invite link instead. */
export default function BabySetup({ suggestedName, onCreated }: Props) {
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [myName, setMyName] = useState(suggestedName)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    if (!name.trim() || !myName.trim()) {
      setError('Fill in the baby\'s name and your name.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await createBaby({ name: name.trim(), birthDate: birthDate || null, displayName: myName.trim() })
      haptic('success')
      onCreated()
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-sm space-y-5 pt-4">
      <div className="space-y-2 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <BabyIcon className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-semibold">Set up the baby tracker</h2>
        <p className="text-sm text-muted-foreground">
          Log feeds, diapers and sleep, and share the log with your partner. You can invite them once it's set up.
        </p>
      </div>

      <div className="space-y-3">
        <label className="block space-y-1.5">
          <span className="px-1 text-xs font-medium text-muted-foreground">Baby's name</span>
          <Input value={name} maxLength={60} placeholder="Or just “Baby” for now" onChange={e => setName(e.target.value)} className="h-11" />
        </label>
        <label className="block space-y-1.5">
          <span className="px-1 text-xs font-medium text-muted-foreground">Birth date (leave empty until the baby is born)</span>
          <Input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} className="h-11" />
        </label>
        <label className="block space-y-1.5">
          <span className="px-1 text-xs font-medium text-muted-foreground">Your name (shown on entries you log)</span>
          <Input value={myName} maxLength={40} placeholder="e.g. Dad" onChange={e => setMyName(e.target.value)} className="h-11" />
        </label>
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={busy} className="h-12 w-full rounded-xl text-base font-semibold">
        {busy ? 'Setting up…' : 'Create tracker'}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Joining your partner's tracker instead? Open the invite link they sent you; there's nothing to set up here.
      </p>
    </form>
  )
}
