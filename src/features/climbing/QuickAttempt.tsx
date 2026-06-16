import { useState } from 'react'
import { CheckCircle2, Circle } from 'lucide-react'
import { CLIMBING_GRADES } from '../../utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'

type Props = {
  onAdd: (grade: string, result: 'sent' | 'project') => void
}

export default function QuickAttempt({ onAdd }: Props) {
  const [grade, setGrade] = useState('v5-6')

  return (
    <div className="bg-muted/50 rounded-2xl p-4 space-y-3">
      <p className="text-sm font-medium text-muted-foreground">Quick add attempt</p>
      <Select value={grade} onValueChange={setGrade}>
        <SelectTrigger className="h-12 text-base font-semibold">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CLIMBING_GRADES.map(g => (
            <SelectItem key={g} value={g} className="text-base">{g}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onAdd(grade, 'sent')}
          className="flex items-center justify-center gap-2 h-14 rounded-xl bg-green-500 text-white font-semibold text-base active:scale-95 transition-transform"
        >
          <CheckCircle2 className="h-5 w-5" />
          SENT
        </button>
        <button
          onClick={() => onAdd(grade, 'project')}
          className="flex items-center justify-center gap-2 h-14 rounded-xl bg-amber-500 text-white font-semibold text-base active:scale-95 transition-transform"
        >
          <Circle className="h-5 w-5" />
          PROJECT
        </button>
      </div>
    </div>
  )
}
