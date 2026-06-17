import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '../../supabase'
import type { ClimbingSession, ClimbingAttempt } from '../../supabase'
import { formatDate } from '../../utils'

type SessionWithAttempts = ClimbingSession & { attempts: ClimbingAttempt[] }

export default function SessionHistory() {
  const [sessions, setSessions] = useState<SessionWithAttempts[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function load() {
      const { data: sessionsData } = await supabase
        .from('climbing_sessions')
        .select('*')
        .order('session_date', { ascending: false })
        .limit(50)

      if (!sessionsData?.length) { setLoading(false); return }

      const { data: attemptsData } = await supabase
        .from('climbing_attempts')
        .select('*')
        .in('session_id', sessionsData.map(s => s.id))

      setSessions(sessionsData.map(s => ({
        ...s,
        attempts: (attemptsData ?? []).filter(a => a.session_id === s.id),
      })))
      setLoading(false)
    }
    load()
  }, [])

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (loading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>

  if (!sessions.length) return (
    <div className="text-center py-12 text-muted-foreground">
      <div className="text-4xl mb-3">🧗</div>
      <p className="font-medium">No sessions yet</p>
    </div>
  )

  return (
    <div className="space-y-3">
      {sessions.map(session => {
        const sends = session.attempts.filter(a => a.result === 'sent')
        const projects = session.attempts.filter(a => a.result === 'project')
        const isOpen = expanded.has(session.id)

        const sendsByGrade = sends.reduce<Record<string, number>>((acc, a) => {
          acc[a.grade] = (acc[a.grade] ?? 0) + 1
          return acc
        }, {})

        return (
          <div key={session.id} className="bg-card border border-border rounded-xl overflow-hidden">
            <button
              className="w-full flex items-center gap-3 p-4 text-left"
              onClick={() => toggleExpand(session.id)}
            >
              <div className="flex-1">
                <div className="font-medium">{formatDate(session.session_date)}</div>
                <div className="text-sm text-muted-foreground mt-0.5">
                  {session.attempts.length} attempts · {sends.length} sent · {projects.length} project
                </div>
                {sends.length > 0 && (
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {Object.entries(sendsByGrade).map(([grade, count]) => (
                      <span key={grade} className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                        {grade} ×{count}
                      </span>
                    ))}
                  </div>
                )}
                {session.notes && <p className="text-xs text-muted-foreground mt-1 italic">"{session.notes}"</p>}
              </div>
              {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
            </button>
            {isOpen && (
              <div className="border-t border-border px-4 pb-4 pt-3 space-y-1.5">
                {session.attempts.map(a => (
                  <div key={a.id} className="flex items-center gap-3 text-sm">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${a.result === 'sent' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {a.result === 'sent' ? 'SENT' : 'PROJ'}
                    </span>
                    <span>{a.grade}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
