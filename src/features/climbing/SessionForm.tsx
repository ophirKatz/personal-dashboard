import { useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../supabase'
import type { ClimbingAttempt } from '../../supabase'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Textarea } from '../../components/ui/textarea'
import { today } from '../../utils'
import QuickAttempt from './QuickAttempt'

type LocalAttempt = Omit<ClimbingAttempt, 'id' | 'session_id' | 'user_id' | 'created_at'>

type Props = {
  userId: string
  onSaved: () => void
}

export default function SessionForm({ userId, onSaved }: Props) {
  const [sessionDate, setSessionDate] = useState(today())
  const [notes, setNotes] = useState('')
  const [attempts, setAttempts] = useState<LocalAttempt[]>([])
  const [saving, setSaving] = useState(false)

  function addAttempt(grade: string, result: 'sent' | 'project') {
    setAttempts(prev => [...prev, { grade, result }])
  }

  function removeAttempt(index: number) {
    setAttempts(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSave() {
    if (attempts.length === 0) return
    setSaving(true)

    const { data: session, error } = await supabase
      .from('climbing_sessions')
      .insert({ session_date: sessionDate, notes: notes.trim() || null, user_id: userId })
      .select()
      .single()

    if (error || !session) { setSaving(false); return }

    await supabase.from('climbing_attempts').insert(
      attempts.map(a => ({ ...a, session_id: session.id, user_id: userId }))
    )

    setAttempts([])
    setNotes('')
    setSessionDate(today())
    setSaving(false)
    onSaved()
  }

  const sends = attempts.filter(a => a.result === 'sent').length
  const projects = attempts.filter(a => a.result === 'project').length

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Date</Label>
          <Input type="date" value={sessionDate} onChange={e => setSessionDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Notes</Label>
          <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="How'd it feel?" className="h-10 resize-none" />
        </div>
      </div>

      <QuickAttempt onAdd={addAttempt} />

      {attempts.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{attempts.length} attempt{attempts.length !== 1 ? 's' : ''} · {sends} sent · {projects} project</p>
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {attempts.map((a, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2 bg-card border border-border rounded-lg">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${a.result === 'sent' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {a.result === 'sent' ? 'SENT' : 'PROJ'}
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
