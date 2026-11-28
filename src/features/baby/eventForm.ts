// The logic behind the "log an entry" form: what it starts with and what it turns into when
// saved. Pure (no React), so the rules are tested rather than hoped for.
import {
  MAX_BOTTLE_ML,
  feedMethod,
  fromLocalInput,
  latestOf,
  minutesAgo,
  toLocalInput,
  type BabyEvent,
  type BabyEventType,
  type BreastSide,
  type DiaperKind,
  type EventDraft,
  type FeedMethod,
  type MilkContent,
  type StoolColor,
} from './babyEvents'

export type FormTarget =
  | { mode: 'create'; type: 'feed' | 'diaper' | 'sleep' | 'note' }
  | { mode: 'edit'; event: BabyEvent }

export type FormState = {
  /** datetime-local values (local time). */
  startedAt: string
  endedAt: string
  method: FeedMethod
  side: BreastSide
  ml: number
  content: MilkContent
  food: string
  /** Minutes, as typed, for a breast feed that is already over. */
  durationMin: string
  kind: DiaperKind
  stoolColor: StoolColor | null
  note: string
}

/** What the last feeds looked like, so the next one starts where the last one left off. */
export type FeedDefaults = {
  method: FeedMethod | null
  side: BreastSide | null
  ml: number | null
  content: MilkContent | null
}

export const DEFAULT_BOTTLE_ML = 60
export const BOTTLE_STEP_ML = 10

export function formType(target: FormTarget): BabyEventType {
  return target.mode === 'create' ? target.type : target.event.type
}

export function feedDefaults(events: BabyEvent[]): FeedDefaults {
  const lastFeed = latestOf(events, e => e.type === 'feed')
  const lastBottle = latestOf(events, e => e.type === 'feed' && feedMethod(e) === 'bottle')
  const lastBreast = latestOf(events, e => e.type === 'feed' && feedMethod(e) === 'breast' && isSide(e.details.side))
  const ml = lastBottle?.details.ml
  const content = lastBottle?.details.content
  return {
    method: lastFeed ? feedMethod(lastFeed) : null,
    side: lastBreast ? (lastBreast.details.side as BreastSide) : null,
    ml: typeof ml === 'number' ? ml : null,
    content: content === 'breast_milk' || content === 'formula' ? content : null,
  }
}

const isSide = (v: unknown): v is BreastSide => v === 'left' || v === 'right' || v === 'both'

/** Nursing alternates, so after the left side comes the right. */
export function nextSide(last: BreastSide | null): BreastSide {
  return last === 'left' ? 'right' : 'left'
}

export function initialForm(target: FormTarget, defaults: FeedDefaults, now: number): FormState {
  const base: FormState = {
    startedAt: toLocalInput(new Date(now)),
    endedAt: '',
    method: defaults.method ?? 'breast',
    side: nextSide(defaults.side),
    ml: defaults.ml ?? DEFAULT_BOTTLE_ML,
    content: defaults.content ?? 'formula',
    food: '',
    durationMin: '',
    kind: 'wet',
    stoolColor: null,
    note: '',
  }

  if (target.mode === 'create') {
    // A sleep is nearly always logged afterwards, so start from "the last hour".
    return target.type === 'sleep'
      ? { ...base, startedAt: toLocalInput(minutesAgo(60, now)), endedAt: toLocalInput(new Date(now)) }
      : base
  }

  const e = target.event
  const d = e.details
  const color = STOOL_VALUES.find(c => c === d.stool_color) ?? null
  return {
    ...base,
    startedAt: toLocalInput(e.started_at),
    endedAt: e.ended_at ? toLocalInput(e.ended_at) : '',
    method: feedMethod(e) ?? base.method,
    side: isSide(d.side) ? d.side : 'left',
    ml: typeof d.ml === 'number' ? d.ml : base.ml,
    content: d.content === 'breast_milk' || d.content === 'formula' ? d.content : base.content,
    food: typeof d.food === 'string' ? d.food : '',
    kind: d.kind === 'wet' || d.kind === 'dirty' || d.kind === 'both' || d.kind === 'dry' ? d.kind : 'wet',
    stoolColor: color,
    note: e.note ?? '',
  }
}

const STOOL_VALUES: StoolColor[] = ['black', 'green', 'yellow', 'brown', 'orange', 'red', 'grey_white']

export const canHaveStool = (kind: DiaperKind) => kind === 'dirty' || kind === 'both'

/**
 * Turns the form into what gets saved. `startTimer` begins a running breast feed from now,
 * ignoring the time fields. Editing keeps any details the form doesn't know about.
 */
export function buildDraft(form: FormState, target: FormTarget, now: number, startTimer = false): EventDraft {
  const type = formType(target)
  const editing = target.mode === 'edit' ? target.event : null
  const details: Record<string, unknown> = { ...(editing?.details ?? {}) }

  if (type === 'feed') {
    for (const key of ['method', 'side', 'ml', 'content', 'food']) delete details[key]
    details.method = form.method
    if (form.method === 'breast') details.side = form.side
    if (form.method === 'bottle') {
      details.ml = Math.round(form.ml)
      details.content = form.content
    }
    if (form.method === 'solids' && form.food.trim()) details.food = form.food.trim()
  } else if (type === 'diaper') {
    delete details.kind
    delete details.stool_color
    details.kind = form.kind
    if (canHaveStool(form.kind) && form.stoolColor) details.stool_color = form.stoolColor
  }

  const note = form.note.trim() || null
  const nowIso = new Date(now).toISOString()

  if (startTimer) {
    return { type, started_at: nowIso, ended_at: null, in_progress: true, details, note }
  }

  const started = fromLocalInput(form.startedAt) ?? ''
  if (editing?.in_progress) {
    return { type, started_at: started, ended_at: null, in_progress: true, details, note }
  }

  let ended: string | null = null
  if (type === 'sleep' || editing?.ended_at) {
    ended = fromLocalInput(form.endedAt)
  } else if (type === 'feed' && form.method === 'breast') {
    const minutes = Number(form.durationMin)
    const startMs = new Date(started).getTime()
    if (minutes > 0 && Number.isFinite(minutes) && !Number.isNaN(startMs)) ended = new Date(startMs + minutes * 60_000).toISOString()
  }

  return { type, started_at: started, ended_at: ended, in_progress: false, details, note }
}

export function clampMl(ml: number): number {
  if (!Number.isFinite(ml)) return DEFAULT_BOTTLE_ML
  return Math.min(MAX_BOTTLE_ML, Math.max(0, Math.round(ml)))
}
