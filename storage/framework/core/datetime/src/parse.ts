import { zonedFormatter } from './intl'
import { dateFromParts } from './parts'

function validateCalendar(year: number, month: number, day: number): void {
  const date = dateFromParts(year, month, day, 0, 0, 0, 0, true)
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day)
    throw new RangeError('Invalid calendar date')
}

/**
 * Parse a date string into a Date object.
 *
 * When a format string is provided, extracts date parts using the same tokens
 * as the format function (YYYY, MM, DD, HH, mm, ss, etc.).
 *
 * If the format includes a Z token, the parsed offset is applied so the
 * returned Date represents the correct instant in time.
 *
 * When no format is given, falls back to native Date parsing (with a fix
 * for date-only ISO strings being treated as local time, not UTC).
 */
export function parse(dateStr: string, formatStr?: string, locale = 'en'): Date {
  if (!formatStr) {
    // Date-only ISO strings (YYYY-MM-DD) are parsed as UTC by spec,
    // which causes unexpected day shifts in local time. Normalize to local.
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [y, m, d] = dateStr.split('-').map(Number)
      if (y === undefined || m === undefined || d === undefined) {
        throw new Error(`Unable to parse date: ${dateStr}`)
      }
      validateCalendar(y, m - 1, d)
      return dateFromParts(y, m - 1, d)
    }
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime())) throw new Error(`Unable to parse date: ${dateStr}`)
    return d
  }

  // Token patterns for extraction
  const tokenDefs: Record<string, { regex: string, field: string }> = {
    YYYY: { regex: '(\\d{4})', field: 'year' },
    YY: { regex: '(\\d{2})', field: 'shortYear' },
    MMMM: { regex: '(.+?)', field: 'monthName' },
    MMM: { regex: '(.+?)', field: 'monthNameShort' },
    MM: { regex: '(\\d{2})', field: 'month' },
    M: { regex: '(\\d{1,2})', field: 'month' },
    DD: { regex: '(\\d{2})', field: 'day' },
    D: { regex: '(\\d{1,2})', field: 'day' },
    HH: { regex: '(\\d{2})', field: 'hours' },
    H: { regex: '(\\d{1,2})', field: 'hours' },
    hh: { regex: '(\\d{2})', field: 'hours12' },
    h: { regex: '(\\d{1,2})', field: 'hours12' },
    mm: { regex: '(\\d{2})', field: 'minutes' },
    m: { regex: '(\\d{1,2})', field: 'minutes' },
    ss: { regex: '(\\d{2})', field: 'seconds' },
    s: { regex: '(\\d{1,2})', field: 'seconds' },
    A: { regex: '(AM|PM)', field: 'ampm' },
    a: { regex: '(am|pm)', field: 'ampm' },
    Z: { regex: '([+-]\\d{4})', field: 'tz' },
  }

  // Sort tokens longest-first to avoid partial matching
  const sortedTokens = Object.keys(tokenDefs).sort((a, b) => b.length - a.length)
  const tokenRegex = new RegExp(sortedTokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g')

  // Build a regex from the format string, capturing each token
  const fields: string[] = []
  const escape = (literal: string) => literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  let regexStr = ''
  let cursor = 0
  for (const match of formatStr.matchAll(tokenRegex)) {
    regexStr += escape(formatStr.slice(cursor, match.index))
    const token = match[0]
    const def = tokenDefs[token]!
    fields.push(def.field)
    regexStr += def.regex
    cursor = match.index + token.length
  }
  regexStr += escape(formatStr.slice(cursor))

  const finalRegex = new RegExp(`^${regexStr}$`)
  const result = finalRegex.exec(dateStr)

  if (!result) {
    throw new Error(`Unable to parse "${dateStr}" with format "${formatStr}"`)
  }

  const parts: Record<string, string> = {}
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i]
    const value = result[i + 1]
    if (field !== undefined && value !== undefined) parts[field] = value
  }

  // Resolve month from name if needed
  let month = 0
  if (parts.month) {
    month = Number.parseInt(parts.month, 10) - 1
  }
  else if (parts.monthName || parts.monthNameShort) {
    const normalize = (name: string) => name.normalize('NFC').toLocaleLowerCase(locale)
    const name = normalize(parts.monthName || parts.monthNameShort || '')
    const long = zonedFormatter(locale, { month: 'long', timeZone: 'UTC' })
    const short = zonedFormatter(locale, { month: 'short', timeZone: 'UTC' })
    const idx = Array.from({ length: 12 }, (_, index) => index).find((index) => {
      const date = dateFromParts(2024, index, 15, 12, 0, 0, 0, true)
      return normalize(long.format(date)) === name || normalize(short.format(date)) === name
    })
    if (idx === undefined) throw new Error(`Unknown month: ${parts.monthName || parts.monthNameShort}`)
    month = idx
  }

  let year = parts.year ? Number.parseInt(parts.year, 10) : new Date().getFullYear()
  if (parts.shortYear) {
    const shortYear = Number.parseInt(parts.shortYear, 10)
    year = shortYear >= 70 ? 1900 + shortYear : 2000 + shortYear
  }

  let hours = Number.parseInt(parts.hours || parts.hours12 || '0', 10)
  if (hours < (parts.hours12 ? 1 : 0) || hours > (parts.hours12 ? 12 : 23))
    throw new RangeError('Invalid clock hour')
  if (parts.ampm) {
    const isPM = parts.ampm.toLowerCase() === 'pm'
    if (isPM && hours < 12) hours += 12
    if (!isPM && hours === 12) hours = 0
  }

  const day = Number.parseInt(parts.day || '1', 10)
  const minutes = Number.parseInt(parts.minutes || '0', 10)
  const seconds = Number.parseInt(parts.seconds || '0', 10)

  validateCalendar(year, month, day)
  if (minutes > 59 || seconds > 59) throw new RangeError('Invalid clock time')

  // If a timezone offset was parsed, construct as UTC then adjust
  if (parts.tz) {
    const sign = parts.tz[0] === '+' ? 1 : -1
    const tzHours = Number.parseInt(parts.tz.slice(1, 3), 10)
    const tzMinutes = Number.parseInt(parts.tz.slice(3, 5), 10)
    if (tzHours > 23 || tzMinutes > 59) throw new RangeError('Invalid timezone offset')
    const offsetMs = sign * (tzHours * 60 + tzMinutes) * 60000

    // Build UTC time, then subtract the offset to get the actual instant
    const utcMs = dateFromParts(year, month, day, hours, minutes, seconds, 0, true).getTime() - offsetMs
    return new Date(utcMs)
  }

  return dateFromParts(year, month, day, hours, minutes, seconds)
}
