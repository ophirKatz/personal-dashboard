import { format, parseISO } from 'date-fns'
import type { ClimbingSession, ClimbingAttempt } from '../../supabase'

type SessionWithAttempts = ClimbingSession & { attempts: ClimbingAttempt[] }

function gradeCounts(attempts: ClimbingAttempt[]): Record<string, number> {
  return attempts.reduce<Record<string, number>>((acc, a) => {
    acc[a.grade] = (acc[a.grade] ?? 0) + 1
    return acc
  }, {})
}

export function buildSessionShareText(session: SessionWithAttempts): string {
  const sends = session.attempts.filter(a => a.result === 'sent')
  const projects = session.attempts.filter(a => a.result === 'project')

  const lines = [
    `🧗 *Climbing Session* — ${format(parseISO(session.session_date), 'EEEE, MMM d, yyyy')}`,
    '',
    `📊 ${session.attempts.length} attempts · ${sends.length} sent · ${projects.length} project${projects.length === 1 ? '' : 's'}`,
  ]

  if (sends.length) {
    lines.push('', '✅ *Sends:*')
    for (const [grade, count] of Object.entries(gradeCounts(sends))) lines.push(`   ${grade} ×${count}`)
  }

  if (projects.length) {
    lines.push('', '🚧 *Projects:*')
    for (const [grade, count] of Object.entries(gradeCounts(projects))) lines.push(`   ${grade} ×${count}`)
  }

  if (session.notes) lines.push('', `📝 _"${session.notes}"_`)

  return lines.join('\n')
}

export function shareSessionToWhatsApp(session: SessionWithAttempts) {
  const text = buildSessionShareText(session)
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
}
