import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line, Legend, ResponsiveContainer } from 'recharts'
import { supabase } from '../../supabase'
import type { ClimbingAttempt, ClimbingSession } from '../../supabase'
import { CLIMBING_GRADES } from '../../utils'
import { subMonths, parseISO, format } from 'date-fns'

type Period = '1m' | '6m' | '1y' | 'all'

const PERIODS: { key: Period; label: string }[] = [
  { key: '1m', label: '1 Month' },
  { key: '6m', label: '6 Months' },
  { key: '1y', label: '1 Year' },
  { key: 'all', label: 'All Time' },
]

const GRADE_COLORS = [
  '#6366f1', '#3b82f6', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316',
]

export default function ClimbingStats() {
  const [period, setPeriod] = useState<Period>('6m')
  const [sessions, setSessions] = useState<ClimbingSession[]>([])
  const [attempts, setAttempts] = useState<ClimbingAttempt[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: s } = await supabase.from('climbing_sessions').select('*')
      const { data: a } = await supabase.from('climbing_attempts').select('*')
      setSessions(s ?? [])
      setAttempts(a ?? [])
      setLoading(false)
    }
    load()
  }, [])

  function periodCutoff(p: Period): Date | null {
    const now = new Date()
    if (p === '1m') return subMonths(now, 1)
    if (p === '6m') return subMonths(now, 6)
    if (p === '1y') return subMonths(now, 12)
    return null
  }

  const cutoff = periodCutoff(period)
  const filteredSessions = cutoff
    ? sessions.filter(s => parseISO(s.session_date) >= cutoff!)
    : sessions
  const sessionIds = new Set(filteredSessions.map(s => s.id))
  const filteredAttempts = attempts.filter(a => sessionIds.has(a.session_id))
  const filteredSends = filteredAttempts.filter(a => a.result === 'sent')

  // Sends per grade bar chart
  const sendsPerGrade = CLIMBING_GRADES.map(g => ({
    grade: g,
    sends: filteredSends.filter(a => a.grade === g).length,
  })).filter(d => d.sends > 0)

  // Progression: sends per grade per month
  const monthsInPeriod = (() => {
    const months: string[] = []
    const now = new Date()
    const start = cutoff ?? (filteredSessions.length > 0
      ? parseISO(filteredSessions[filteredSessions.length - 1].session_date)
      : subMonths(now, 6))
    const d = new Date(start.getFullYear(), start.getMonth(), 1)
    while (d <= now) {
      months.push(format(d, 'yyyy-MM'))
      d.setMonth(d.getMonth() + 1)
    }
    return months
  })()

  const topGrades = CLIMBING_GRADES.filter(g =>
    filteredSends.some(a => a.grade === g)
  ).slice(-5)

  const progressionData = monthsInPeriod.map(month => {
    const monthSessions = filteredSessions.filter(s => s.session_date.startsWith(month))
    const monthSessionIds = new Set(monthSessions.map(s => s.id))
    const monthSends = filteredSends.filter(a => monthSessionIds.has(a.session_id))
    const point: Record<string, number | string> = { month: format(parseISO(month + '-01'), 'MMM yy') }
    topGrades.forEach(g => { point[g] = monthSends.filter(a => a.grade === g).length })
    return point
  })

  if (loading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-8">
      {/* Period selector */}
      <div className="flex gap-1 bg-muted p-1 rounded-xl">
        {PERIODS.map(p => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${period === p.key ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {filteredSends.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">No sends in this period</div>
      ) : (
        <>
          {/* Sends per grade */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Sends by Grade</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={sendsPerGrade} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="grade" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="sends" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Progression per grade */}
          {topGrades.length > 0 && monthsInPeriod.length > 1 && (
            <div>
              <h3 className="text-sm font-semibold mb-3">Progression Over Time</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={progressionData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {topGrades.map((g, i) => (
                    <Line
                      key={g}
                      type="monotone"
                      dataKey={g}
                      stroke={GRADE_COLORS[i % GRADE_COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  )
}
