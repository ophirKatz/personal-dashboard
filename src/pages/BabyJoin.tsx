import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Baby as BabyIcon } from 'lucide-react'
import { supabase } from '../supabase'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { haptic } from '../lib/haptics'
import { acceptInvite } from '../features/baby/babyApi'
import type { AcceptOutcome } from '../features/baby/babyInvites'

const MESSAGES: Record<'invalid' | 'wrong_email' | 'invalid_name' | 'error', string> = {
  invalid: 'This invite link has already been used, was cancelled, or has expired. Ask for a new one.',
  wrong_email: 'This invite was made for a different email address. Sign out and sign in with the Google account it was sent to.',
  invalid_name: 'Enter your name (up to 40 characters).',
  error: "Couldn't join. Check your connection and try again.",
}

// Opened from an invite link (/baby/join/:token). Signing in first is handled before this renders.
export default function BabyJoin() {
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<Exclude<AcceptOutcome['status'], 'joined' | 'already_member'> | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const meta = data.user?.user_metadata as Record<string, unknown> | undefined
      const full = meta?.full_name ?? meta?.name
      if (typeof full === 'string') setName(n => n || full.trim().split(/\s+/)[0] || '')
    })
  }, [])

  async function join(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setProblem(null)
    const outcome = await acceptInvite(token, name.trim())
    if (outcome.status === 'joined' || outcome.status === 'already_member') {
      haptic('success')
      navigate('/baby', { replace: true })
      return
    }
    setProblem(outcome.status)
    setBusy(false)
  }

  return (
    <div className="mx-auto max-w-sm space-y-5 p-4 pt-10">
      <div className="space-y-2 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <BabyIcon className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-bold">Join the baby tracker</h1>
        <p className="text-sm text-muted-foreground">
          You've been invited to log and see feeds, diapers and sleep together.
        </p>
      </div>

      <form onSubmit={join} className="space-y-4">
        <label className="block space-y-1.5">
          <span className="px-1 text-xs font-medium text-muted-foreground">Your name (shown on entries you log)</span>
          <Input value={name} maxLength={40} placeholder="e.g. Mom" onChange={e => setName(e.target.value)} className="h-11" />
        </label>

        {problem && <p role="alert" className="text-sm text-destructive">{MESSAGES[problem]}</p>}

        <Button type="submit" disabled={busy || !name.trim()} className="h-12 w-full rounded-xl text-base font-semibold">
          {busy ? 'Joining…' : 'Join'}
        </Button>
      </form>

      <p className="text-center text-xs text-muted-foreground">
        <Link to="/baby" className="underline underline-offset-2">Open my own tracker instead</Link>
      </p>
    </div>
  )
}
