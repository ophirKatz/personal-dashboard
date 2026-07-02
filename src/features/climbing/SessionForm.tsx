import { useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { supabase } from '../../supabase'
import type { ClimbingAttempt } from '../../supabase'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { today } from '../../utils'
import { haptic } from '../../lib/haptics'
import QuickAttempt from './QuickAttempt'
import AttemptsList from './AttemptsList'
import { nextClimbResult } from './climbResult'

type LocalAttempt = Omit<ClimbingAttempt, 'id' | 'session_id' | 'user_id' | 'created_at'>

type Props = {
  userId: string
  onSaved: () => void
}

export default function SessionForm({ userId, onSaved }: Props) {
  const [sessionDate, setSessionDate] = useState(today())
  const [attempts, setAttempts] = useState<LocalAttempt[]>([])
  const [saving, setSaving] = useState(false)

  function addAttempt(grade: string) {
    setAttempts(prev => [...prev, { grade, result: 'sent' }])
  }

  function removeAttempt(index: number) {
    haptic('light')
    setAttempts(prev => prev.filter((_, i) => i !== index))
  }

  function toggleAttemptResult(index: number) {
    haptic('light')
    setAttempts(prev =>
      prev.map((a, i) => (i === index ? { ...a, result: nextClimbResult(a.result) } : a)),
    )
  }

  async function handleSave() {
    if (attempts.length === 0) return
    setSaving(true)

    const { data: session, error } = await supabase
      .from('climbing_sessions')
      .insert({ session_date: sessionDate, notes: null, user_id: userId })
      .select()
      .single()

    if (error || !session) { setSaving(false); return }

    await supabase.from('climbing_attempts').insert(
      attempts.map(a => ({ ...a, session_id: session.id, user_id: userId }))
    )

    haptic('success')
    setAttempts([])
    setSessionDate(today())
    setSaving(false)
    onSaved()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <CalendarDays className="h-4 w-4 shrink-0" />
        <Input
          type="date"
          value={sessionDate}
          onChange={e => setSessionDate(e.target.value)}
          className="w-auto h-8 px-2 py-1 text-sm text-foreground"
        />
      </div>

      <QuickAttempt onAdd={addAttempt} />

      {attempts.length > 0 && (
        <div className="space-y-2">
          <AttemptsList attempts={attempts} onToggleResult={toggleAttemptResult} onRemove={removeAttempt} />
          <Button onClick={handleSave} disabled={saving || attempts.length === 0} className="w-full" size="lg">
            {saving ? 'Saving…' : `Save Session (${attempts.length} attempts)`}
          </Button>
        </div>
      )}
    </div>
  )
}
