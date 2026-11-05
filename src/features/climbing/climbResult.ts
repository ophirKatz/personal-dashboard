export const CLIMB_RESULTS = ['sent', 'project', 'completed_project'] as const

export type ClimbResult = typeof CLIMB_RESULTS[number]

export function nextClimbResult(result: ClimbResult): ClimbResult {
  return CLIMB_RESULTS[(CLIMB_RESULTS.indexOf(result) + 1) % CLIMB_RESULTS.length]
}

export const CLIMB_RESULT_BADGE: Record<ClimbResult, string> = {
  sent: 'bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-300',
  project: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300',
  completed_project: 'bg-fuchsia-100 dark:bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300',
}

export const CLIMB_RESULT_LABEL: Record<ClimbResult, string> = {
  sent: 'SENT',
  project: 'PROJ',
  completed_project: 'DONE',
}
