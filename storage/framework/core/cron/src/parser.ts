/**
 * Native 5-field cron expression parser.
 *
 * Implements the same API as Bun.cron.parse() — when Bun ships native
 * cron support, this can be swapped out with a one-line change.
 *
 * Supports:
 * - Standard 5-field format: minute hour dayOfMonth month dayOfWeek
 * - Nicknames: @yearly, @annually, @monthly, @weekly, @daily, @midnight, @hourly
 * - Operators: * (all), , (list), - (range), / (step)
 * - Named values: JAN-DEC, SUN-SAT (case-insensitive)
 * - POSIX OR logic: when both dayOfMonth and dayOfWeek are specified (neither *),
 *   the expression matches when either condition is true
 */

const NICKNAMES: Record<string, string> = {
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
  '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@hourly': '0 * * * *',
}

const MONTH_NAMES: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  january: 1, february: 2, march: 3, april: 4, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
}

const DAY_NAMES: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
}

/**
 * Track which 6-field expressions we've already warned about so a
 * scheduler tick doesn't spam the log every iteration
 * (stacksjs/stacks#1877 Cr-6, mirroring #1872 Q-12).
 */
const sixFieldWarnedFor = new Set<string>()

function warnSecondsIgnored(expression: string, secondsField: string): void {
  if (sixFieldWarnedFor.has(expression)) return
  sixFieldWarnedFor.add(expression)
  // eslint-disable-next-line no-console
  console.warn(
    `[cron] 6-field cron expression '${expression}' has seconds='${secondsField}' — the parser is 5-field only. `
    + `Seconds field IGNORED. For second-precision use the scheduler's '.everySecond()' instead.`,
  )
}

function resolveNames(value: string, names: Record<string, number>): string {
  return value.replace(/[a-z]+/gi, match => {
    const num = names[match.toLowerCase()]
    if (num === undefined) throw new Error(`Invalid cron value: ${match}`)
    return String(num)
  })
}

function parseField(field: string, min: number, max: number, names?: Record<string, number>): Set<number> {
  const resolved = names ? resolveNames(field, names) : field
  const values = new Set<number>()

  for (const part of resolved.split(',')) {
    const stepMatch = part.match(/^(.+)\/(\d+)$/)
    let range: string
    let step = 1

    if (stepMatch) {
      range = stepMatch[1] ?? ''
      step = Number.parseInt(stepMatch[2] ?? '', 10)
      if (step <= 0) throw new Error(`Invalid step: ${step}`)
    }
    else {
      range = part
    }

    if (range === '*') {
      for (let i = min; i <= max; i += step) values.add(i)
    }
    else if (range.includes('-')) {
      const [startStr, endStr] = range.split('-')
      const start = Number.parseInt(startStr ?? '', 10)
      const end = Number.parseInt(endStr ?? '', 10)
      if (Number.isNaN(start) || Number.isNaN(end)) throw new Error(`Invalid range: ${range}`)
      if (start < min || end > max) throw new Error(`Range out of bounds: ${range} (${min}-${max})`)
      for (let i = start; i <= end; i += step) values.add(i)
    }
    else {
      const num = Number.parseInt(range, 10)
      if (Number.isNaN(num)) throw new Error(`Invalid cron value: ${range}`)
      if (num < min || num > max) throw new Error(`Value out of range: ${num} (${min}-${max})`)
      values.add(num)
    }
  }

  return values
}

/**
 * Options for `parseCron` (stacksjs/stacks#1877 Cr-5).
 */
export interface ParseCronOptions {
  /**
   * IANA timezone (e.g. `'America/Los_Angeles'`) the cron expression
   * should be interpreted against. When set, field comparisons run
   * in local time within that zone — `'0 14 * * *'` fires at 14:00
   * local instead of 14:00 UTC. Defaults to UTC for backwards-compat.
   *
   * **DST caveat (Cr-1, deferred):** spring-forward (e.g. 02:00→03:00
   * in US Pacific) and fall-back (02:00 happens twice) can cause
   * fires to be skipped or duplicated for expressions whose hour
   * lands in the transition window. Most scheduled tasks don't care
   * because they fire on the 0th minute of every hour. Tasks that
   * MUST fire exactly once during the transition need a TZ-aware
   * scheduler layer above this parser.
   */
  tz?: string
}

/**
 * Parse a cron expression and return the next matching Date.
 *
 * @param expression - A 5-field cron expression or nickname (@daily, etc.)
 * @param relativeDate - Starting point for the search (defaults to Date.now())
 * @param options - Optional `{ tz }` for timezone-local interpretation
 * @returns The next Date matching the expression, or null if no match within ~4 years
 */
export function parseCron(expression: string, relativeDate?: Date | number, options: ParseCronOptions = {}): Date | null {
  const trimmed = expression.trim()
  const normalized = NICKNAMES[trimmed.toLowerCase()] ?? trimmed

  let fields = normalized.split(/\s+/).filter(Boolean)

  // 6-field cron (with leading seconds) is widely used by Quartz /
  // Spring schedulers. This parser is 5-field, but rather than
  // throw and break the user's app at boot, drop the seconds field
  // with a once-per-expression warn (stacksjs/stacks#1877 Cr-6).
  // If the seconds field is non-zero/non-wildcard, the user is
  // expressing intent that's silently lost — the warn surfaces that.
  if (fields.length === 6) {
    const secondsField = fields[0]!
    if (secondsField !== '0' && secondsField !== '*')
      warnSecondsIgnored(expression, secondsField)
    fields = fields.slice(1)
  }

  if (fields.length !== 5) {
    throw new Error(`Invalid cron expression: expected 5 fields (or 6 with leading seconds), got ${fields.length}`)
  }

  const [minuteField, hourField, domField, monthField, dowField] = fields as [string, string, string, string, string]
  const minutes = parseField(minuteField, 0, 59)
  const hours = parseField(hourField, 0, 23)
  const daysOfMonth = parseField(domField, 1, 31)
  const months = parseField(monthField, 1, 12, MONTH_NAMES)
  const daysOfWeek = parseField(dowField, 0, 7, DAY_NAMES)

  // Normalize Sunday: 7 → 0
  if (daysOfWeek.has(7)) {
    daysOfWeek.add(0)
    daysOfWeek.delete(7)
  }

  // POSIX: if both dayOfMonth and dayOfWeek are specified (neither is *), use OR logic
  const domWild = domField === '*'
  const dowWild = dowField === '*'

  // Start point
  const base = relativeDate instanceof Date
    ? relativeDate.getTime()
    : typeof relativeDate === 'number'
      ? relativeDate
      : Date.now()

  if (Number.isNaN(base) || !Number.isFinite(base)) {
    throw new Error('Invalid date')
  }

  // When a timezone is configured, build a part-extractor that reads
  // local time in that zone instead of UTC (stacksjs/stacks#1877 Cr-5).
  // The search loop still advances in UTC milliseconds, but field
  // comparisons happen against the TZ-local view. The extra cost is
  // an Intl.DateTimeFormat per iteration — measurable on a fast loop
  // but negligible for the once-per-tick cron path.
  const tz = options.tz
  const getParts = tz
    ? makeTzPartsExtractor(tz)
    : (date: Date) => ({
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,
        day: date.getUTCDate(),
        hour: date.getUTCHours(),
        minute: date.getUTCMinutes(),
        dow: date.getUTCDay(),
      })

  // Begin search from the next minute
  const d = new Date(base)
  d.setUTCSeconds(0, 0)
  d.setUTCMinutes(d.getUTCMinutes() + 1)

  // Search up to ~4 years
  const maxTime = d.getTime() + 4 * 365.25 * 24 * 60 * 60 * 1000

  while (d.getTime() < maxTime) {
    const parts = getParts(d)

    // Month check
    if (!months.has(parts.month)) {
      d.setUTCMonth(d.getUTCMonth() + 1, 1)
      d.setUTCHours(0, 0, 0, 0)
      continue
    }

    // Day check (POSIX OR logic)
    const domMatch = daysOfMonth.has(parts.day)
    const dowMatch = daysOfWeek.has(parts.dow)

    let dayMatch: boolean
    if (domWild && dowWild)
      dayMatch = true
    else if (domWild)
      dayMatch = dowMatch
    else if (dowWild)
      dayMatch = domMatch
    else
      dayMatch = domMatch || dowMatch // POSIX OR

    if (!dayMatch) {
      d.setUTCDate(d.getUTCDate() + 1)
      d.setUTCHours(0, 0, 0, 0)
      continue
    }

    // Hour check
    if (!hours.has(parts.hour)) {
      d.setUTCHours(d.getUTCHours() + 1, 0, 0, 0)
      continue
    }

    // Minute check
    if (!minutes.has(parts.minute)) {
      d.setUTCMinutes(d.getUTCMinutes() + 1, 0, 0)
      continue
    }

    return new Date(d.getTime())
  }

  return null // No match within ~4 years (e.g. Feb 30)
}

/**
 * Build a part-extractor for the given IANA timezone. Uses
 * `Intl.DateTimeFormat.formatToParts` which is fast in Bun and
 * handles DST automatically (the same instant in UTC may produce
 * different local parts on either side of a transition).
 *
 * The day-of-week is computed via the `weekday: 'short'` field
 * mapped to 0-6 (Sunday = 0) to match the cron convention.
 */
function makeTzPartsExtractor(tz: string): (d: Date) => { year: number, month: number, day: number, hour: number, minute: number, dow: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    weekday: 'short',
  })
  const DOW_MAP: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return (d: Date) => {
    const parts = fmt.formatToParts(d)
    let year = 0
    let month = 0
    let day = 0
    let hour = 0
    let minute = 0
    let dow = 0
    for (const p of parts) {
      if (p.type === 'year') year = Number.parseInt(p.value, 10)
      else if (p.type === 'month') month = Number.parseInt(p.value, 10)
      else if (p.type === 'day') day = Number.parseInt(p.value, 10)
      else if (p.type === 'hour') hour = Number.parseInt(p.value, 10) % 24 // 24:00 → 00 normalization
      else if (p.type === 'minute') minute = Number.parseInt(p.value, 10)
      else if (p.type === 'weekday') dow = DOW_MAP[p.value] ?? 0
    }
    return { year, month, day, hour, minute, dow }
  }
}
