import { useState } from 'react'
import { X, CalendarDays } from 'lucide-react'
import { supabase } from '../../supabase'
import type { ClimbingSession, ClimbingAttempt } from '../../supabase'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Textarea } from '../../components/ui/textarea'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody } from '../../components/ui/drawer'
import { haptic } from '../../lib/haptics'
import QuickAttempt from './QuickAttempt'

type LocalAttempt = { grade: string; result: 'sent' | 'project' }

type Props = {
  open: boolean
  onClose: () => void
  onSaved: () => void
  session: ClimbingSession & { attempts: ClimbingAttempt[] }
}

export default function EditSessionDrawer({ open, onClose, onSaved, session }: Props) {
  const [sessionDate, setSessionDate] = useState(session.session_date)
  const [notes, setNotes] = useState(session.notes ?? '')
  const [attempts, setAttempts] = useState<LocalAttempt[]>(
    session.attempts.map(a => ({ grade: a.grade, result: a.result })),
  )
  const [saving, setSaving] = useState(false)

  function addAttempt(grade: string) {
    setAttempts(prev => [...prev, { grade, result: 'sent' }])
  }

  function removeAttempt(index: number) {
    haptic('light')
    setAttempts(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSave() {
    setSaving(true)

    await supabase
      .from('climbing_sessions')
      .update({ session_date: sessionDate, notes: notes.trim() || null })
      .eq('id', session.id)

    await supabase.from('climbing_attempts').delete().eq('session_id', session.id)
    if (attempts.length > 0) {
      await supabase.from('climbing_attempts').insert(
        attempts.map(a => ({ ...a, session_id: session.id, user_id: session.user_id })),
      )
    }

    haptic('success')
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <Drawer open={open} onOpenChange={(v) => !v && onClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Edit session</DrawerTitle>
        </DrawerHeader>
        <DrawerBody className="space-y-5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarDays className="h-4 w-4 shrink-0" />
            <Input
              type="date"
              value={sessionDate}
              onChange={e => setSessionDate(e.target.value)}
              className="w-auto h-8 px-2 py-1 text-sm text-foreground"
            />
          </div>

          <Textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            className="min-h-[60px] text-sm"
          />

          <QuickAttempt onAdd={addAttempt} />

          <div className="space-y-2">
            <p className="text-sm font-medium">{attempts.length} attempt{attempts.length !== 1 ? 's' : ''}</p>
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
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full" size="lg">
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  )
}
