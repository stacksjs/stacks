import { localDateTime } from './local'
import { zonedTimeToUtc } from './zone'

export class ScheduleInputError extends RangeError {
  readonly status = 422
}
export interface WeeklySchedule { weekdays: number[], start_time: string }
export interface TimeWindow { start_time: string, end_time: string }
const DAY = 86_400_000

/** A real canonical calendar date, not a date that Date silently normalizes. */
export function calendarDay(value: string): number {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ScheduleInputError('Use yyyy-mm-dd dates')
  const date = new Date(`${value}T00:00:00Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new ScheduleInputError('Invalid calendar date')
  return date.getTime() / DAY
}

export function clockMinutes(value: string): number {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) throw new ScheduleInputError('Use HH:MM times')
  const [hour, minute] = value.split(':').map(Number)
  if (hour! > 23 || minute! > 59) throw new ScheduleInputError('Invalid clock time')
  return hour! * 60 + minute!
}

/** Same-day slots must retain their full duration. Crossing midnight is an error. */
export function addClockMinutes(start: string, duration: number): string {
  if (!Number.isSafeInteger(duration) || duration <= 0) throw new ScheduleInputError('Duration must be positive whole minutes')
  const end = clockMinutes(start) + duration
  if (end >= 1440) throw new ScheduleInputError('Session must end before midnight; shorten it or move its start time')
  return `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`
}

/** Invalid weekday entries invalidate the entire recurrence, rather than changing its meaning. */
export function parseWeeklySchedule(value: unknown): WeeklySchedule | null {
  try {
    const data = typeof value === 'string' ? JSON.parse(value) : value
    if (!data || typeof data !== 'object' || Array.isArray(data) || !Array.isArray(data.weekdays) || !data.weekdays.length) return null
    const weekdays = data.weekdays.map((day: unknown) => {
      if (typeof day !== 'number' && (typeof day !== 'string' || !/^[0-6]$/.test(day.trim()))) throw new ScheduleInputError('Invalid weekday')
      const number = Number(day)
      if (!Number.isInteger(number) || number < 0 || number > 6) throw new ScheduleInputError('Invalid weekday')
      return number
    })
    clockMinutes(data.start_time)
    return { weekdays: [...new Set<number>(weekdays)], start_time: data.start_time }
  }
  catch (error) {
    if (error instanceof SyntaxError || error instanceof ScheduleInputError) return null
    throw error
  }
}

export function expandWeeklySchedule(spec: WeeklySchedule, from: string, to: string, duration: number, maxDays = 800): Array<{ session_date: string, start_time: string, end_time: string }> {
  const first = calendarDay(from)
  const last = calendarDay(to)
  if (!Number.isSafeInteger(maxDays) || maxDays < 1) throw new ScheduleInputError('Invalid date-range limit')
  if (last < first) throw new ScheduleInputError('from must be on or before to')
  if (last - first + 1 > maxDays) throw new ScheduleInputError(`Generate at most ${maxDays} days at a time`)
  const schedule = parseWeeklySchedule(spec)
  if (!schedule) throw new ScheduleInputError('Invalid recurrence')
  const end = addClockMinutes(schedule.start_time, duration)
  const days = new Set(schedule.weekdays)
  const slots = []
  for (let day = first; day <= last; day++) {
    const date = new Date(day * DAY)
    if (days.has(date.getUTCDay())) slots.push({ session_date: date.toISOString().slice(0, 10), start_time: schedule.start_time, end_time: end })
  }
  return slots
}

/** Adjacent/overlapping windows together cover a slot; gaps remain unavailable. */
export function timeWindowsCover(windows: readonly TimeWindow[], start: string, end: string): boolean {
  const first = clockMinutes(start)
  const last = clockMinutes(end)
  if (first >= last) return false
  const spans = windows.map(window => ({ start: clockMinutes(window.start_time), end: clockMinutes(window.end_time) })).sort((a, b) => a.start - b.start)
  let covered = first
  for (const span of spans) {
    if (span.end <= span.start) throw new ScheduleInputError('Availability must end after it starts')
    if (span.start > covered) break
    covered = Math.max(covered, span.end)
    if (covered >= last) return true
  }
  return false
}

/** Inclusive local dates become a half-open instant range, including 23/25-hour DST days. */
export function localDateRange(from: string, to: string, ...zones: unknown[]): { start: Date, end: Date, timeZone: string } {
  const first = calendarDay(from)
  const last = calendarDay(to)
  if (last < first) throw new ScheduleInputError('from must be on or before to')
  // Offset probes must also stay above year 0099, which Date.UTC remaps to 1999.
  if (Number(from.slice(0, 4)) < 101 || to >= '9999-12-31') throw new ScheduleInputError('Local ranges support dates from 0101-01-01 through 9999-12-30')
  const timeZone = localDateTime(new Date(first * DAY), ...zones).timeZone
  const next = new Date((last + 1) * DAY).toISOString().slice(0, 10)
  return { start: zonedTimeToUtc(`${from}T00:00:00`, timeZone), end: zonedTimeToUtc(`${next}T00:00:00`, timeZone), timeZone }
}

/** Keep full elapsed-time precision until money or display formatting is applied. */
export function netHoursBetween(start: Date | string | null, end: Date | string | null, breakMinutes = 0): number {
  if (start == null || end == null || !Number.isFinite(breakMinutes)) return 0
  const first = start instanceof Date ? start.getTime() : Date.parse(start)
  const last = end instanceof Date ? end.getTime() : Date.parse(end)
  if (!Number.isFinite(first) || !Number.isFinite(last) || last <= first) return 0
  return Math.max(0, (last - first) / 3_600_000 - Math.max(0, breakMinutes) / 60)
}

/** A location's clock interval as real instants; an earlier end time belongs to the next day. */
export function localTimeSpan(date: string, start: string, end: string, ...zones: unknown[]): { start: Date, end: Date, timeZone: string } {
  const day = calendarDay(date)
  const first = clockMinutes(start)
  const last = clockMinutes(end)
  if (first === last) throw new ScheduleInputError('An interval must have distinct start and end times')
  if (Number(date.slice(0, 4)) < 101 || date >= '9999-12-31') throw new ScheduleInputError('Unsupported local interval date')
  const timeZone = localDateTime(new Date(day * DAY), ...zones).timeZone
  const endDate = last < first ? new Date((day + 1) * DAY).toISOString().slice(0, 10) : date
  const interval = { start: zonedTimeToUtc(`${date}T${start}:00`, timeZone), end: zonedTimeToUtc(`${endDate}T${end}:00`, timeZone), timeZone }
  if (interval.end <= interval.start) throw new ScheduleInputError('The local interval has no positive duration in this timezone')
  return interval
}
