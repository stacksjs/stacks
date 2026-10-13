import { localDateTime, zonedTimeToUtc } from '@stacksjs/datetime'

/**
 * Sequences: a list of steps run one after another for one person, with
 * waits between them. "Email now, wait two days, text, wait a week, give
 * the front desk a call task" is a sequence; so is a welcome series or a
 * win-back journey.
 *
 * This module is the timing engine only, and it is pure. It never sends
 * or stores anything. The application keeps each person's place (the next
 * step's index and when it is due), and on every tick asks
 * {@link advanceSequence} what to do now and where to pick up afterwards.
 * Sending, and remembering what was sent, stay with the caller, so the
 * same engine drives email, SMS, push, or tasks for staff.
 *
 * Quiet hours are read in the recipient's (or the business's) time zone,
 * so "not between 21:00 and 08:00" means the same thing to a gym in
 * Berlin and one in Denver, across daylight saving changes.
 */

/** A window, in local wall-clock time, in which messages are held back. */
export interface QuietHours {
  /** When the quiet window starts, `HH:mm` in `timeZone` (for example `21:00`). */
  start: string
  /** When it ends, `HH:mm` (for example `08:00`). Before `start` means it runs past midnight. */
  end: string
  /** The IANA zone the times are read in (for example `Europe/Berlin`). */
  timeZone: string
}

/** The smallest shape a step needs: its type, and the length of a wait. */
export interface SequenceStepLike {
  type: string
  /** Minutes to wait, for a `wait` step. */
  minutes?: number
}

export interface SequenceAdvance<S> {
  /** Steps to perform now, in order. */
  run: Array<{ index: number, step: S }>
  /**
   * Where the sequence picks up: the index of the next step and the instant
   * it is due. Null once every step has run.
   */
  next: { index: number, at: Date } | null
}

export interface AdvanceSequenceOptions<S> {
  /** Hold quiet-hours steps until the window is over. Null or absent: no quiet hours. */
  quietHours?: QuietHours | null
  /**
   * Whether a step waits out quiet hours. Defaults to every step that is not
   * a wait: a message should not arrive at 2am. Return false for steps that
   * reach nobody's phone, such as a task on a staff to-do list.
   */
  respectsQuietHours?: (step: S) => boolean
}

const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/

function clockMinutes(value: string, field: string): number {
  const match = CLOCK.exec(String(value))
  if (!match)
    throw new RangeError(`Quiet hours ${field} must be a time like 21:00`)
  return Number(match[1]) * 60 + Number(match[2])
}

function addDays(ymd: string, days: number): string {
  const date = new Date(`${ymd}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** Whether `at` falls inside the quiet window. A window that starts and ends at the same time is no window. */
export function isQuietTime(at: Date, quiet: QuietHours | null | undefined): boolean {
  if (!quiet)
    return false
  const start = clockMinutes(quiet.start, 'start')
  const end = clockMinutes(quiet.end, 'end')
  if (start === end)
    return false
  const clock = localDateTime(at, quiet.timeZone)
  const now = clockMinutes(clock.time, 'time')
  return start < end ? now >= start && now < end : now >= start || now < end
}

/**
 * The first instant at or after `at` that is outside the quiet window: `at`
 * itself when it is not quiet, else the window's end in the zone's local
 * time (the next morning, for a window that started the evening before).
 */
export function nextSendableTime(at: Date, quiet: QuietHours | null | undefined): Date {
  if (!quiet || !isQuietTime(at, quiet))
    return at
  const start = clockMinutes(quiet.start, 'start')
  const clock = localDateTime(at, quiet.timeZone)
  const now = clockMinutes(clock.time, 'time')
  // An overnight window that started this evening ends tomorrow morning;
  // otherwise it ends later the same local day.
  const endDay = start > clockMinutes(quiet.end, 'end') && now >= start ? addDays(clock.date, 1) : clock.date
  return zonedTimeToUtc(`${endDay}T${quiet.end}`, clock.timeZone)
}

function waitMinutes(step: SequenceStepLike): number {
  const minutes = Number(step.minutes ?? 0)
  if (!Number.isFinite(minutes) || minutes < 0)
    throw new RangeError('A wait step needs zero or more minutes')
  return minutes
}

/**
 * What to do now for someone whose next step is `index`, at `now`.
 *
 * Runs forward from `index`: every step that is due is returned in `run`, up
 * to the first wait (which sets when the sequence continues) or the first
 * step that would land in quiet hours (which is held until they end). A
 * wait of zero minutes is passed straight over. When the steps run out,
 * `next` is null and the sequence is finished.
 */
export function advanceSequence<S extends SequenceStepLike>(steps: readonly S[], index: number, now: Date, options: AdvanceSequenceOptions<S> = {}): SequenceAdvance<S> {
  if (!Number.isSafeInteger(index) || index < 0)
    throw new RangeError('A sequence position must be a whole number of zero or more')
  const respects = options.respectsQuietHours ?? ((step: S) => step.type !== 'wait')
  const run: Array<{ index: number, step: S }> = []
  for (let position = index; position < steps.length; position++) {
    const step = steps[position]!
    if (step.type === 'wait') {
      const minutes = waitMinutes(step)
      if (minutes > 0)
        return { run, next: { index: position + 1, at: new Date(now.getTime() + minutes * 60_000) } }
      continue
    }
    if (respects(step) && isQuietTime(now, options.quietHours))
      return { run, next: { index: position, at: nextSendableTime(now, options.quietHours) } }
    run.push({ index: position, step })
  }
  return { run, next: null }
}

/**
 * When each step would run for someone who starts the sequence at `start`,
 * assuming every tick comes on time: what a preview shows ("day 0, 09:00:
 * welcome email; day 2: text"). Waits are not listed.
 */
export function sequenceTimeline<S extends SequenceStepLike>(steps: readonly S[], start: Date, options: AdvanceSequenceOptions<S> = {}): Array<{ index: number, step: S, at: Date }> {
  const timeline: Array<{ index: number, step: S, at: Date }> = []
  let position = 0
  let at = start
  // Each pass either runs steps or moves time forward, so steps.length * 2
  // passes is always enough; the bound only guards against a bad option.
  for (let pass = 0; pass <= steps.length * 2 + 1; pass++) {
    const advance = advanceSequence(steps, position, at, options)
    for (const item of advance.run)
      timeline.push({ ...item, at })
    if (!advance.next)
      break
    position = advance.next.index
    at = advance.next.at
  }
  return timeline
}
