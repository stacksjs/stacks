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
      range = stepMatch[1]
      step = Number.parseInt(stepMatch[2])
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
      const start = Number.parseInt(startStr)
      const end = Number.parseInt(endStr)
      if (Number.isNaN(start) || Number.isNaN(end)) throw new Error(`Invalid range: ${range}`)
      if (start < min || end > max) throw new Error(`Range out of bounds: ${range} (${min}-${max})`)
      for (let i = start; i <= end; i += step) values.add(i)
    }
    else {
      const num = Number.parseInt(range)
      if (Number.isNaN(num)) throw new Error(`Invalid cron value: ${range}`)
      if (num < min || num > max) throw new Error(`Value out of range: ${num} (${min}-${max})`)
      values.add(num)
    }
  }

  return values
}

/**
 * Parse a cron expression and return the next matching UTC Date.
 *
 * @param expression - A 5-field cron expression or nickname (@daily, etc.)
 * @param relativeDate - Starting point for the search (defaults to Date.now())
 * @returns The next Date matching the expression (UTC), or null if no match within ~4 years
 */
export function parseCron(expression: string, relativeDate?: Date | number): Date | null {
  const trimmed = expression.trim()
  const normalized = NICKNAMES[trimmed.toLowerCase()] ?? trimmed

  const fields = normalized.split(/\s+/).filter(Boolean)
  if (fields.length !== 5) {
    throw new Error(`Invalid cron expression: expected 5 fields, got ${fields.length}`)
  }

  const minutes = parseField(fields[0], 0, 59)
  const hours = parseField(fields[1], 0, 23)
  const daysOfMonth = parseField(fields[2], 1, 31)
  const months = parseField(fields[3], 1, 12, MONTH_NAMES)
  const daysOfWeek = parseField(fields[4], 0, 7, DAY_NAMES)

  // Normalize Sunday: 7 → 0
  if (daysOfWeek.has(7)) {
    daysOfWeek.add(0)
    daysOfWeek.delete(7)
  }

  // POSIX: if both dayOfMonth and dayOfWeek are specified (neither is *), use OR logic
  const domWild = fields[2] === '*'
  const dowWild = fields[4] === '*'

  // Start point
  const base = relativeDate instanceof Date
    ? relativeDate.getTime()
    : typeof relativeDate === 'number'
      ? relativeDate
      : Date.now()

  if (Number.isNaN(base) || !Number.isFinite(base)) {
    throw new Error('Invalid date')
  }

  // Begin search from the next minute
  const d = new Date(base)
  d.setUTCSeconds(0, 0)
  d.setUTCMinutes(d.getUTCMinutes() + 1)

  // Search up to ~4 years
  const maxTime = d.getTime() + 4 * 365.25 * 24 * 60 * 60 * 1000

  while (d.getTime() < maxTime) {
    // Month check
    if (!months.has(d.getUTCMonth() + 1)) {
      d.setUTCMonth(d.getUTCMonth() + 1, 1)
      d.setUTCHours(0, 0, 0, 0)
      continue
    }

    // Day check (POSIX OR logic)
    const domMatch = daysOfMonth.has(d.getUTCDate())
    const dowMatch = daysOfWeek.has(d.getUTCDay())

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
    if (!hours.has(d.getUTCHours())) {
      d.setUTCHours(d.getUTCHours() + 1, 0, 0, 0)
      continue
    }

    // Minute check
    if (!minutes.has(d.getUTCMinutes())) {
      d.setUTCMinutes(d.getUTCMinutes() + 1, 0, 0)
      continue
    }

    return new Date(d.getTime())
  }

  return null // No match within ~4 years (e.g. Feb 30)
}
