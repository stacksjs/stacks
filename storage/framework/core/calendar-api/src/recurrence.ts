/**
 * RFC 5545 RRULE expansion - the subset schools actually use: FREQ
 * DAILY/WEEKLY/MONTHLY/YEARLY, INTERVAL, COUNT, UNTIL, BYDAY (day lists, and
 * monthly ordinals like `2TU`), BYMONTHDAY (`-1` is the last day) and WKST.
 * Calendar clients expand a feed's RRULE themselves; this expansion is for
 * the SERVER's own needs - "next occurrences" listings and change
 * notifications - so it has to land on the same dates they do.
 *
 * A rule using anything else is refused (`parseRRule` returns null) rather
 * than expanded without it: `BYMONTH=11;BYDAY=4TH` with BYMONTH ignored is a
 * date that is not Thanksgiving, and nothing would say so.
 *
 * All arithmetic is UTC-based on the provided Date objects; callers own
 * timezone interpretation, matching the rest of calendar-api.
 */

type DayCode = 'SU' | 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA'

export interface RecurrenceRule {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
  interval: number
  count?: number
  until?: Date
  /**
   * Day codes. Monthly entries may carry an ordinal (`2TU`, `-1FR`); a plain
   * code there means every such day of the month.
   */
  byDay?: string[]
  /** Days of the month: 1 to 31, or -1 (the last) to -31. */
  byMonthDay?: number[]
  /** The day a week starts on, which decides the weeks an INTERVAL skips. RFC 5545 default: `MO`. */
  weekStart?: DayCode
}

const DAY_CODES: readonly DayCode[] = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']
const SUPPORTED_PARTS = new Set(['FREQ', 'INTERVAL', 'COUNT', 'UNTIL', 'BYDAY', 'BYMONTHDAY', 'WKST'])
const BYDAY_ENTRY = /^([+-]?\d{1,2})?(SU|MO|TU|WE|TH|FR|SA)$/

/**
 * Parse an RRULE value (`FREQ=WEEKLY;BYDAY=MO,WE;COUNT=10`). Null for a rule
 * this expander cannot follow exactly: an unsupported frequency or part, a
 * part given twice, a value it cannot read, or a combination RFC 5545 rules
 * out or this subset does not implement.
 */
export function parseRRule(rule: string): RecurrenceRule | null {
  const parts = new Map<string, string>()
  for (const piece of rule.trim().replace(/^RRULE:/i, '').split(';')) {
    if (!piece.trim())
      continue
    const eq = piece.indexOf('=')
    const name = (eq === -1 ? piece : piece.slice(0, eq)).trim().toUpperCase()
    if (eq === -1 || !SUPPORTED_PARTS.has(name) || parts.has(name))
      return null
    parts.set(name, piece.slice(eq + 1).trim())
  }

  const freq = parts.get('FREQ')?.toUpperCase()
  if (freq !== 'DAILY' && freq !== 'WEEKLY' && freq !== 'MONTHLY' && freq !== 'YEARLY')
    return null

  const parsed: RecurrenceRule = { freq, interval: 1 }

  const interval = parts.get('INTERVAL')
  if (interval !== undefined) {
    if (!/^\d+$/.test(interval) || Number(interval) < 1)
      return null
    parsed.interval = Number(interval)
  }

  const count = parts.get('COUNT')
  if (count !== undefined) {
    if (!/^\d+$/.test(count) || Number(count) < 1)
      return null
    parsed.count = Number(count)
  }

  const until = parts.get('UNTIL')
  if (until !== undefined) {
    // UNTIL is either a date (YYYYMMDD) or UTC datetime (YYYYMMDDTHHMMSSZ).
    const match = until.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/)
    if (!match)
      return null
    parsed.until = new Date(Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4] ?? 23),
      Number(match[5] ?? 59),
      Number(match[6] ?? 59),
    ))
  }

  // RFC 5545: COUNT and UNTIL MUST NOT occur in the same rule.
  if (parsed.count !== undefined && parsed.until)
    return null

  const byDay = parts.get('BYDAY')
  if (byDay !== undefined) {
    // Day lists filter DAILY and WEEKLY, and select within a month. Ordinals
    // only mean something per month here; yearly ones (`20MO`) are not
    // implemented.
    if (freq === 'YEARLY')
      return null
    const entries: string[] = []
    for (const raw of byDay.split(',')) {
      const match = raw.trim().toUpperCase().match(BYDAY_ENTRY)
      if (!match)
        return null
      const ordinal = match[1] === undefined ? 0 : Number(match[1])
      if (match[1] !== undefined && (freq !== 'MONTHLY' || ordinal === 0 || Math.abs(ordinal) > 5))
        return null
      entries.push(`${ordinal === 0 ? '' : ordinal}${match[2]}`)
    }
    parsed.byDay = entries
  }

  const byMonthDay = parts.get('BYMONTHDAY')
  if (byMonthDay !== undefined) {
    // RFC 5545 forbids BYMONTHDAY with WEEKLY; YEARLY with it is not implemented.
    if (freq === 'WEEKLY' || freq === 'YEARLY')
      return null
    const days: number[] = []
    for (const raw of byMonthDay.split(',')) {
      if (!/^[+-]?\d{1,2}$/.test(raw.trim()))
        return null
      const day = Number(raw.trim())
      if (day === 0 || Math.abs(day) > 31)
        return null
      days.push(day)
    }
    parsed.byMonthDay = days
  }

  const weekStart = parts.get('WKST')?.toUpperCase()
  if (weekStart !== undefined) {
    if (!DAY_CODES.includes(weekStart as DayCode))
      return null
    parsed.weekStart = weekStart as DayCode
  }

  return parsed
}

function utcDay(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day))
}

function sameClock(from: Date, onDay: Date): Date {
  const result = new Date(onDay)
  result.setUTCHours(from.getUTCHours(), from.getUTCMinutes(), from.getUTCSeconds(), 0)
  return result
}

/** Does `day` (1-based, in a month of `length` days) match a BYMONTHDAY entry? */
function isMonthDay(entry: number, day: number, length: number): boolean {
  return entry > 0 ? entry === day : length + 1 + entry === day
}

/** Does `date` match a BYDAY entry? An ordinal counts within its month. */
function isByDay(entry: string, date: Date): boolean {
  const match = entry.match(BYDAY_ENTRY)!
  if (DAY_CODES.indexOf(match[2] as DayCode) !== date.getUTCDay())
    return false
  if (match[1] === undefined)
    return true
  const ordinal = Number(match[1])
  const day = date.getUTCDate()
  const length = utcDay(date.getUTCFullYear(), date.getUTCMonth() + 1, 0).getUTCDate()
  return ordinal > 0 ? Math.ceil(day / 7) === ordinal : Math.ceil((length - day + 1) / 7) === -ordinal
}

/**
 * The days a rule selects in its `period`-th day, week, month or year from
 * `dtstart`, in order, with the date that period starts on.
 *
 * Months and years are counted from dtstart's and normalised by Date.UTC,
 * so a series goes on past December: comparing `getUTCMonth()` with an
 * unnormalised month index ended every monthly ordinal rule there.
 */
function periodDays(rule: RecurrenceRule, dtstart: Date, period: number): { start: Date, days: Date[] } {
  const year = dtstart.getUTCFullYear()
  const month = dtstart.getUTCMonth()
  const date = dtstart.getUTCDate()
  const byDay = (day: Date) => !rule.byDay || rule.byDay.some(entry => isByDay(entry, day))
  const byMonthDay = (day: Date) => {
    if (!rule.byMonthDay)
      return true
    const length = utcDay(day.getUTCFullYear(), day.getUTCMonth() + 1, 0).getUTCDate()
    return rule.byMonthDay.some(entry => isMonthDay(entry, day.getUTCDate(), length))
  }

  if (rule.freq === 'DAILY') {
    const day = utcDay(year, month, date + period)
    return { start: day, days: byDay(day) && byMonthDay(day) ? [day] : [] }
  }

  if (rule.freq === 'WEEKLY') {
    // Weeks begin on WKST, Monday unless the rule says otherwise. Sunday-start
    // weeks put `INTERVAL=2;BYDAY=SU,MO` on different Sundays than every
    // calendar client expanding the same rule.
    const weekStart = DAY_CODES.indexOf(rule.weekStart ?? 'MO')
    const first = utcDay(year, month, date - ((dtstart.getUTCDay() - weekStart + 7) % 7) + 7 * period)
    const days: Date[] = []
    for (let offset = 0; offset < 7; offset++) {
      const day = utcDay(first.getUTCFullYear(), first.getUTCMonth(), first.getUTCDate() + offset)
      if (rule.byDay ? byDay(day) : day.getUTCDay() === dtstart.getUTCDay())
        days.push(day)
    }
    return { start: first, days }
  }

  if (rule.freq === 'MONTHLY') {
    const first = utcDay(year, month + period, 1)
    const length = utcDay(first.getUTCFullYear(), first.getUTCMonth() + 1, 0).getUTCDate()
    const days: Date[] = []
    for (let day = 1; day <= length; day++) {
      const candidate = utcDay(first.getUTCFullYear(), first.getUTCMonth(), day)
      // With neither part, dtstart's day of the month, which a short month
      // does not have (RFC 5545 skips it).
      const selected = rule.byDay || rule.byMonthDay
        ? byDay(candidate) && byMonthDay(candidate)
        : day === date
      if (selected)
        days.push(candidate)
    }
    return { start: first, days }
  }

  // YEARLY: dtstart's month and day, skipped in a year that does not have it
  // (Feb 29). Date.UTC would roll it into March 1.
  const day = utcDay(year + period, month, date)
  return { start: utcDay(year + period, 0, 1), days: day.getUTCMonth() === month ? [day] : [] }
}

/**
 * Occurrence start times for `rule` anchored at `dtstart`, intersected with
 * [windowStart, windowEnd]. COUNT/UNTIL are honored from the anchor, so a
 * window in the middle of a COUNT=10 series sees only the occurrences that
 * fall inside it. Capped defensively at 1000 occurrences.
 */
export function expandRecurrence(rule: RecurrenceRule, dtstart: Date, windowStart: Date, windowEnd: Date): Date[] {
  // An invalid date compares false with everything, so the walk would never end.
  if ([dtstart, windowStart, windowEnd].some(date => Number.isNaN(date.getTime())))
    throw new RangeError('expandRecurrence needs valid dates for dtstart and the window')

  const results: Date[] = []
  const hardCap = 1000
  let emitted = 0

  for (let period = 0; ; period += rule.interval) {
    const { start, days } = periodDays(rule, dtstart, period)
    if (start.getTime() > windowEnd.getTime() || (rule.until && start.getTime() > rule.until.getTime()))
      return results

    for (const day of days) {
      const occurrence = sameClock(dtstart, day)
      if (occurrence.getTime() < dtstart.getTime())
        continue
      if (occurrence.getTime() > windowEnd.getTime() || (rule.until && occurrence.getTime() > rule.until.getTime()))
        return results
      if (rule.count !== undefined && emitted >= rule.count)
        return results
      emitted++
      if (occurrence.getTime() >= windowStart.getTime()) {
        results.push(occurrence)
        if (results.length >= hardCap)
          return results
      }
    }
  }
}
