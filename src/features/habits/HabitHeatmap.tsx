import { useEffect, useMemo, useRef } from 'react'
import { format, subDays, eachDayOfInterval, parseISO, isToday } from 'date-fns'

type Props = {
  logs: string[] // array of logged_date strings 'yyyy-MM-dd'
  color: string
}

export default function HabitHeatmap({ logs, color }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const logSet = useMemo(() => new Set(logs), [logs])

  const days = useMemo(() => {
    const end = new Date()
    const start = subDays(end, 364)
    return eachDayOfInterval({ start, end })
  }, [])

  const weeks = useMemo(() => {
    const result: Date[][] = []
    let week: Date[] = []
    days.forEach((day, i) => {
      const dow = day.getDay()
      if (dow === 0 && i > 0) {
        result.push(week)
        week = []
      }
      week.push(day)
    })
    if (week.length) result.push(week)
    return result
  }, [days])

  const monthLabels = useMemo(() => {
    const labels: { label: string; index: number }[] = []
    let lastMonth = -1
    weeks.forEach((week, wi) => {
      const m = week[0].getMonth()
      if (m !== lastMonth) {
        labels.push({ label: format(week[0], 'MMM'), index: wi })
        lastMonth = m
      }
    })
    return labels
  }, [weeks])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [weeks])

  return (
    <div ref={scrollRef} className="overflow-x-auto">
      <div className="inline-block min-w-full">
        {/* Month labels */}
        <div className="flex gap-0.5 mb-1 pl-6">
          {weeks.map((_, wi) => {
            const label = monthLabels.find(l => l.index === wi)
            return (
              <div key={wi} className="w-3 shrink-0 text-[9px] text-muted-foreground">
                {label?.label ?? ''}
              </div>
            )
          })}
        </div>
        <div className="flex gap-0.5">
          {/* Day labels */}
          <div className="flex flex-col gap-0.5 mr-0.5">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <div key={i} className="h-3 w-4 text-[9px] text-muted-foreground flex items-center justify-end pr-0.5">
                {i % 2 === 1 ? d : ''}
              </div>
            ))}
          </div>
          {/* Grid */}
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-0.5">
              {Array.from({ length: 7 }).map((_, dow) => {
                const day = week.find(d => d.getDay() === dow)
                if (!day) return <div key={dow} className="w-3 h-3" />
                const dateStr = format(day, 'yyyy-MM-dd')
                const logged = logSet.has(dateStr)
                const future = day > new Date() && !isToday(day)
                return (
                  <div
                    key={dow}
                    title={dateStr}
                    className="w-3 h-3 rounded-sm"
                    style={{
                      backgroundColor: future
                        ? 'transparent'
                        : logged
                        ? color
                        : 'hsl(var(--muted))',
                      border: future ? '1px solid hsl(var(--border))' : 'none',
                      opacity: future ? 0.3 : 1,
                    }}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
