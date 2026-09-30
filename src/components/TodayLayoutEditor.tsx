import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from './ui/button'
import { haptic } from '../lib/haptics'
import { getTodaySectionsOrder, setTodaySectionsOrder } from '../lib/userSettings'
import {
  DEFAULT_TODAY_SECTIONS_ORDER,
  TODAY_SECTIONS_CHANGED_EVENT,
  TODAY_SECTION_LABELS,
  type TodaySectionKey,
} from '../lib/todaySections'

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list
  const next = [...list]
  next.splice(to, 0, next.splice(from, 1)[0])
  return next
}

export default function TodayLayoutEditor() {
  const [order, setOrder] = useState<TodaySectionKey[] | null>(null)

  useEffect(() => {
    getTodaySectionsOrder().then(setOrder)
  }, [])

  async function save(next: TodaySectionKey[]) {
    haptic('selection')
    setOrder(next)
    window.dispatchEvent(new CustomEvent(TODAY_SECTIONS_CHANGED_EVENT, { detail: next }))
    await setTodaySectionsOrder(next)
  }

  if (!order) return null

  const isDefault = order.every((k, i) => k === DEFAULT_TODAY_SECTIONS_ORDER[i])

  return (
    <div className="space-y-1">
      {order.map((key, i) => (
        <div key={key} className="flex items-center gap-1">
          <span className="flex-1 min-w-0 text-sm px-1.5 py-1.5">{TODAY_SECTION_LABELS[key]}</span>
          <button
            onClick={() => save(move(order, i, i - 1))}
            disabled={i === 0}
            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground disabled:opacity-30"
            title="Move up"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            onClick={() => save(move(order, i, i + 1))}
            disabled={i === order.length - 1}
            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground disabled:opacity-30"
            title="Move down"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      ))}
      {!isDefault && (
        <Button variant="ghost" className="mt-2" onClick={() => save(DEFAULT_TODAY_SECTIONS_ORDER)}>
          Reset to default
        </Button>
      )}
    </div>
  )
}
