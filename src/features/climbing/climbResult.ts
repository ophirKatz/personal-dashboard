export const CLIMB_RESULTS = ['sent', 'project', 'completed_project'] as const

export type ClimbResult = typeof CLIMB_RESULTS[number]

export function nextClimbResult(result: ClimbResult): ClimbResult {
  return CLIMB_RESULTS[(CLIMB_RESULTS.indexOf(result) + 1) % CLIMB_RESULTS.length]
}

export const CLIMB_RESULT_BADGE: Record<ClimbResult, string> = {
  sent: 'bg-green-100 text-green-700',
  project: 'bg-amber-100 text-amber-700',
  completed_project: 'bg-fuchsia-100 text-fuchsia-700',
}

export const CLIMB_RESULT_LABEL: Record<ClimbResult, string> = {
  sent: 'SENT',
  project: 'PROJ',
  completed_project: 'DONE',
}
