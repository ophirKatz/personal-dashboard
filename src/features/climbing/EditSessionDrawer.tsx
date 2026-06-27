import { useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { supabase } from '../../supabase'
import type { ClimbingSession, ClimbingAttempt } from '../../supabase'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Textarea } from '../../components/ui/textarea'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody } from '../../components/ui/drawer'
import { haptic } from '../../lib/haptics'
import QuickAttempt from './QuickAttempt'
import AttemptsList from './AttemptsList'

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

  function toggleAttemptResult(index: number) {
    haptic('light')
    setAttempts(prev =>
      prev.map((a, i) => (i === index ? { ...a, result: a.result === 'sent' ? 'project' : 'sent' } : a)),
    )
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

          <AttemptsList attempts={attempts} onToggleResult={toggleAttemptResult} onRemove={removeAttempt} />

          <Button onClick={handleSave} disabled={saving} className="w-full" size="lg">
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  )
}
