import { useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { supabase } from '../../supabase'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody } from '../../components/ui/drawer'
import { haptic } from '../../lib/haptics'
import { today } from '../../utils'
import QuickAttempt from './QuickAttempt'
import AttemptsList from './AttemptsList'

type LocalAttempt = { grade: string; result: 'sent' | 'project' }

type Props = {
  open: boolean
  onClose: () => void
  onSaved: () => void
  userId: string
}

export default function QuickLogSessionDrawer({ open, onClose, onSaved, userId }: Props) {
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
      prev.map((a, i) => (i === index ? { ...a, result: a.result === 'sent' ? 'project' : 'sent' } : a)),
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
      attempts.map(a => ({ ...a, session_id: session.id, user_id: userId })),
    )

    haptic('success')
    setSaving(false)
    setAttempts([])
    setSessionDate(today())
    onSaved()
    onClose()
  }

  return (
    <Drawer open={open} onOpenChange={(v) => !v && onClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Log session</DrawerTitle>
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

          <QuickAttempt onAdd={addAttempt} />

          <AttemptsList attempts={attempts} onToggleResult={toggleAttemptResult} onRemove={removeAttempt} />

          <Button onClick={handleSave} disabled={saving || attempts.length === 0} className="w-full" size="lg">
            {saving ? 'Saving…' : `Save Session${attempts.length ? ` (${attempts.length})` : ''}`}
          </Button>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  )
}
