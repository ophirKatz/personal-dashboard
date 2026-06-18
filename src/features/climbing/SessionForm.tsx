import { useState } from 'react'
import { X, CalendarDays } from 'lucide-react'
import { supabase } from '../../supabase'
import type { ClimbingAttempt } from '../../supabase'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { today } from '../../utils'
import { haptic } from '../../lib/haptics'
import QuickAttempt from './QuickAttempt'

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
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{attempts.length} attempt{attempts.length !== 1 ? 's' : ''} logged</p>
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {attempts.map((a, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2 bg-card border border-border rounded-lg">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                  SENT
                </span>
                <span className="font-medium text-sm">{a.grade}</span>
                <button onClick={() => removeAttempt(i)} className="ml-auto text-muted-foreground hover:text-destructive">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <Button onClick={handleSave} disabled={saving || attempts.length === 0} className="w-full" size="lg">
            {saving ? 'Saving…' : `Save Session (${attempts.length} attempts)`}
          </Button>
        </div>
      )}
    </div>
  )
}
