import { zonedTimeToUtc } from './zone'

/** Add calendar months, clamping the day to the target month's last day. Input is not mutated. */
export function addCalendarMonths(date: Date, months: number, options: { utc?: boolean } = {}): Date {
  if (!Number.isFinite(date.getTime()) || !Number.isSafeInteger(months)) throw new Error('Calendar arithmetic requires a valid date and integer month count')
  const result = new Date(date)
  if (options.utc) {
    const day = result.getUTCDate()
    result.setUTCDate(1)
    result.setUTCMonth(result.getUTCMonth() + months)
    result.setUTCDate(Math.min(day, new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate()))
  }
  else {
    const day = result.getDate()
    result.setDate(1)
    result.setMonth(result.getMonth() + months)
    result.setDate(Math.min(day, new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate()))
  }
  return result
}

/*
 * Calendar dates as `YYYY-MM-DD` strings.
 *
 * A date column, a training day or a membership period is a day on a
 * calendar, not an instant. Holding it as a `Date` invites the server's zone
 * into every comparison: `new Date('2026-10-18')` is UTC midnight, `new
 * Date(2026, 9, 18)` is local midnight, and the two print different days on
 * half the planet. These helpers keep it a string, do their arithmetic on the
 * UTC calendar (where every day is 24 hours long), and only meet a time zone
 * where a real clock is involved: `todayIn` and `minutesUntil`.
 */

const DAY_MS = 86_400_000
const YMD = /^\d{4}-\d{2}-\d{2}$/
const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/

/** True for a real `YYYY-MM-DD` calendar date. `2026-02-31` and `2026-2-3` are not. */
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !YMD.test(value)) return false
  const time = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value
}

/** True for an IANA time zone this runtime knows (`Europe/Berlin`, `UTC`). */
export function isTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > 64) return false
  try {
    // eslint-disable-next-line no-new
    new Intl.DateTimeFormat('en-US', { timeZone: value })
    return true
  }
  catch {
    return false
  }
}

function dayNumber(ymd: string, name: string): number {
  if (!isCalendarDate(ymd)) throw new RangeError(`${name} expects a YYYY-MM-DD calendar date, got "${String(ymd)}"`)
  return Date.parse(`${ymd}T00:00:00Z`) / DAY_MS
}

function fromDayNumber(day: number): string {
  const result = new Date(day * DAY_MS).toISOString()
  // Years past 9999 print as +010000-...; refuse them rather than return a non-date.
  if (result.length !== 24) throw new RangeError('Calendar date out of range')
  return result.slice(0, 10)
}

/**
 * Today's date in `timeZone`, as `YYYY-MM-DD`.
 *
 * The day a person or a site is living through, which is not the server's day
 * for some hours of every day. Throws a `RangeError` for an unknown zone; to
 * fall back through several (a site's, then its organization's, then UTC),
 * use `localDateTime(now, ...zones).date`.
 *
 * @example
 * todayIn('Pacific/Auckland', new Date('2026-10-18T12:00:00Z')) // '2026-10-19'
 */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  if (!isTimeZone(timeZone)) throw new RangeError(`Unknown time zone "${String(timeZone)}"`)
  if (!Number.isFinite(now.getTime())) throw new RangeError('todayIn expects a valid instant')
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? ''
  return `${get('year').padStart(4, '0')}-${get('month')}-${get('day')}`
}

/** `ymd` moved by `days` calendar days (negative goes back). Month and year ends roll over. */
export function addDays(ymd: string, days: number): string {
  if (!Number.isSafeInteger(days)) throw new RangeError('addDays expects a whole number of days')
  return fromDayNumber(dayNumber(ymd, 'addDays') + days)
}

/** Whole calendar days from `from` to `to`: positive when `to` is later, 0 for the same day. */
export function daysBetween(from: string, to: string): number {
  return dayNumber(to, 'daysBetween') - dayNumber(from, 'daysBetween')
}

/** The Monday that starts the ISO week containing `ymd` (a Monday is its own start). */
export function startOfIsoWeek(ymd: string): string {
  const day = dayNumber(ymd, 'startOfIsoWeek')
  // 1970-01-01 was a Thursday, so day 0 is ISO weekday 4 (Monday = 1).
  const weekday = ((day % 7) + 7 + 3) % 7 // 0 = Monday
  return fromDayNumber(day - weekday)
}

/**
 * Minutes from `now` until clocks in `timeZone` read `time` on `date`.
 *
 * Negative once that moment has passed. The difference is between real
 * instants, so a reminder an hour before a class the morning after a DST
 * change is an hour, not the 0 or 120 minutes that subtracting two wall-clock
 * readings gives. Ambiguous and skipped readings follow `zonedTimeToUtc`.
 * The result keeps the seconds of `now` as a fraction; round it where you
 * display or compare it.
 *
 * @example
 * minutesUntil('2026-10-25', '09:00', 'Europe/Berlin', new Date('2026-10-24T22:00:00Z')) // 600
 */
export function minutesUntil(date: string, time: string, timeZone: string, now: Date = new Date()): number {
  if (!isCalendarDate(date)) throw new RangeError(`minutesUntil expects a YYYY-MM-DD date, got "${String(date)}"`)
  if (typeof time !== 'string' || !CLOCK.test(time)) throw new RangeError(`minutesUntil expects HH:mm or HH:mm:ss, got "${String(time)}"`)
  if (!isTimeZone(timeZone)) throw new RangeError(`Unknown time zone "${String(timeZone)}"`)
  if (!Number.isFinite(now.getTime())) throw new RangeError('minutesUntil expects a valid instant')
  return (zonedTimeToUtc(`${date}T${time}`, timeZone).getTime() - now.getTime()) / 60_000
}
