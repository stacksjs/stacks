/**
 * RFC 5545 RRULE expansion - the subset schools actually use: FREQ
 * DAILY/WEEKLY/MONTHLY/YEARLY, INTERVAL, COUNT, UNTIL, BYDAY (weekly lists
 * and monthly ordinals like `2TU`), BYMONTHDAY. Calendar clients expand a
 * feed's RRULE themselves; this expansion is for the SERVER's own needs -
 * "next occurrences" listings and change notifications.
 *
 * All arithmetic is UTC-based on the provided Date objects; callers own
 * timezone interpretation, matching the rest of calendar-api.
 */

export interface RecurrenceRule {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
  interval: number
  count?: number
  until?: Date
  /** Weekly: plain day codes. Monthly: optionally ordinal-prefixed (`2TU`, `-1FR`). */
  byDay?: string[]
  byMonthDay?: number[]
}

const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const

/** Parse an RRULE value (`FREQ=WEEKLY;BYDAY=MO,WE;COUNT=10`). Null for unsupported input. */
export function parseRRule(rule: string): RecurrenceRule | null {
  const parts: Record<string, string> = {}
  for (const piece of rule.replace(/^RRULE:/i, '').split(';')) {
    const eq = piece.indexOf('=')
    if (eq === -1)
      continue
    parts[piece.slice(0, eq).toUpperCase()] = piece.slice(eq + 1)
  }

  const freq = parts.FREQ?.toUpperCase()
  if (freq !== 'DAILY' && freq !== 'WEEKLY' && freq !== 'MONTHLY' && freq !== 'YEARLY')
    return null

  const parsed: RecurrenceRule = {
    freq,
    interval: Math.max(1, Number(parts.INTERVAL ?? 1) || 1),
  }

  if (parts.COUNT)
    parsed.count = Math.max(1, Number(parts.COUNT) || 1)

  if (parts.UNTIL) {
    // UNTIL is either a date (YYYYMMDD) or UTC datetime (YYYYMMDDTHHMMSSZ).
    const match = parts.UNTIL.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/)
    if (match) {
      parsed.until = new Date(Date.UTC(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
        Number(match[4] ?? 23),
        Number(match[5] ?? 59),
        Number(match[6] ?? 59),
      ))
    }
  }

  if (parts.BYDAY)
    parsed.byDay = parts.BYDAY.split(',').map(day => day.trim().toUpperCase()).filter(Boolean)

  if (parts.BYMONTHDAY)
    parsed.byMonthDay = parts.BYMONTHDAY.split(',').map(Number).filter(day => Number.isInteger(day) && day >= 1 && day <= 31)

  return parsed
}

function sameClock(from: Date, onDay: Date): Date {
  const result = new Date(onDay)
  result.setUTCHours(from.getUTCHours(), from.getUTCMinutes(), from.getUTCSeconds(), 0)
  return result
}

function nthWeekdayOfMonth(year: number, month: number, dayCode: string, ordinal: number): Date | null {
  const dayIndex = DAY_CODES.indexOf(dayCode as typeof DAY_CODES[number])
  if (dayIndex === -1)
    return null

  if (ordinal > 0) {
    const first = new Date(Date.UTC(year, month, 1))
    const offset = (dayIndex - first.getUTCDay() + 7) % 7
    const day = 1 + offset + (ordinal - 1) * 7
    const candidate = new Date(Date.UTC(year, month, day))
    return candidate.getUTCMonth() === month ? candidate : null
  }

  // Negative ordinals count from the end (-1 = last).
  const last = new Date(Date.UTC(year, month + 1, 0))
  const offset = (last.getUTCDay() - dayIndex + 7) % 7
  const day = last.getUTCDate() - offset + (ordinal + 1) * 7
  const candidate = new Date(Date.UTC(year, month, day))
  return candidate.getUTCMonth() === month && day >= 1 ? candidate : null
}

/**
 * Occurrence start times for `rule` anchored at `dtstart`, intersected with
 * [windowStart, windowEnd]. COUNT/UNTIL are honored from the anchor, so a
 * window in the middle of a COUNT=10 series sees only the occurrences that
 * fall inside it. Capped defensively at 1000 occurrences.
 */
export function expandRecurrence(rule: RecurrenceRule, dtstart: Date, windowStart: Date, windowEnd: Date): Date[] {
  const results: Date[] = []
  const hardCap = 1000
  let emitted = 0

  const push = (occurrence: Date): boolean => {
    if (rule.until && occurrence.getTime() > rule.until.getTime())
      return false
    if (rule.count !== undefined && emitted >= rule.count)
      return false
    emitted++
    if (occurrence.getTime() >= windowStart.getTime() && occurrence.getTime() <= windowEnd.getTime())
      results.push(occurrence)
    return results.length < hardCap
  }

  const stop = (candidate: Date): boolean =>
    candidate.getTime() > windowEnd.getTime()
    || (rule.until !== undefined && candidate.getTime() > rule.until.getTime())

  if (rule.freq === 'DAILY') {
    for (let cursor = new Date(dtstart); ; cursor.setUTCDate(cursor.getUTCDate() + rule.interval)) {
      if (stop(cursor) || !push(new Date(cursor)))
        break
    }
    return results
  }

  if (rule.freq === 'WEEKLY') {
    const days = rule.byDay?.length
      ? rule.byDay
      : [DAY_CODES[dtstart.getUTCDay()]!]

    // Walk week by week from the week containing dtstart.
    const weekAnchor = new Date(dtstart)
    weekAnchor.setUTCDate(weekAnchor.getUTCDate() - weekAnchor.getUTCDay())

    outer:
    for (let week = new Date(weekAnchor); ; week.setUTCDate(week.getUTCDate() + 7 * rule.interval)) {
      for (const code of [...days].sort((a, b) => DAY_CODES.indexOf(a as never) - DAY_CODES.indexOf(b as never))) {
        const dayIndex = DAY_CODES.indexOf(code as typeof DAY_CODES[number])
        if (dayIndex === -1)
          continue
        const candidate = sameClock(dtstart, new Date(Date.UTC(week.getUTCFullYear(), week.getUTCMonth(), week.getUTCDate() + dayIndex)))
        if (candidate.getTime() < dtstart.getTime())
          continue
        if (stop(candidate) || !push(candidate))
          break outer
      }
      if (week.getTime() > windowEnd.getTime())
        break
    }
    return results
  }

  if (rule.freq === 'MONTHLY') {
    outer:
    for (let months = 0; ; months += rule.interval) {
      const year = dtstart.getUTCFullYear()
      const monthIndex = dtstart.getUTCMonth() + months
      const candidates: Date[] = []

      if (rule.byDay?.length) {
        for (const entry of rule.byDay) {
          const match = entry.match(/^(-?\d)?([A-Z]{2})$/)
          if (!match)
            continue
          const ordinal = Number(match[1] ?? 1)
          const day = nthWeekdayOfMonth(year, monthIndex, match[2]!, ordinal)
          if (day)
            candidates.push(sameClock(dtstart, day))
        }
      }
      else if (rule.byMonthDay?.length) {
        for (const dayOfMonth of rule.byMonthDay) {
          const candidate = new Date(Date.UTC(year, monthIndex, dayOfMonth))
          if (candidate.getUTCDate() === dayOfMonth)
            candidates.push(sameClock(dtstart, candidate))
        }
      }
      else {
        const candidate = new Date(Date.UTC(year, monthIndex, dtstart.getUTCDate()))
        // A 31st in a short month is skipped, matching RFC semantics.
        if (candidate.getUTCDate() === dtstart.getUTCDate())
          candidates.push(sameClock(dtstart, candidate))
      }

      let sawFuture = false
      for (const candidate of candidates.sort((a, b) => a.getTime() - b.getTime())) {
        if (candidate.getTime() < dtstart.getTime())
          continue
        sawFuture = true
        if (stop(candidate) || !push(candidate))
          break outer
      }

      const monthStart = new Date(Date.UTC(year, monthIndex, 1))
      if (monthStart.getTime() > windowEnd.getTime() && !sawFuture)
        break
    }
    return results
  }

  // YEARLY
  for (let years = 0; ; years += rule.interval) {
    const candidate = new Date(Date.UTC(
      dtstart.getUTCFullYear() + years,
      dtstart.getUTCMonth(),
      dtstart.getUTCDate(),
      dtstart.getUTCHours(),
      dtstart.getUTCMinutes(),
      dtstart.getUTCSeconds(),
    ))
    if (stop(candidate) || !push(candidate))
      break
  }
  return results
}
