import { parse } from './parse'
import { dateFromParts } from './parts'
import { zonedFormatter } from './intl'

type DateInput = Date | string

interface FormatOptions {
  locale?: string
  tz?: string
}

function toDate(input: DateInput): Date {
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) throw new Error('Invalid date')
    return input
  }
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date: ${input}`)
  return /^\d{4}-\d{2}-\d{2}$/.test(input) ? parse(input) : date
}

function pad(n: number, len = 2): string {
  return String(n).padStart(len, '0')
}

interface ClockParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

/** The wall-clock fields of `date` in `tz`, from one shared formatter. */
function getPartsInTz(date: Date, tz: string): ClockParts {
  const parts = zonedFormatter('en-US', {
    timeZone: tz,
    year: 'numeric',
    era: 'short',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? ''

  const displayedYear = Number.parseInt(get('year'), 10)
  const year = get('era') === 'BC' ? 1 - displayedYear : displayedYear
  const month = Number.parseInt(get('month'), 10)
  const day = Number.parseInt(get('day'), 10)
  let hour = Number.parseInt(get('hour'), 10)
  // Intl may return 24 for midnight in some locales
  if (hour === 24) hour = 0
  const minute = Number.parseInt(get('minute'), 10)
  const second = Number.parseInt(get('second'), 10)
  return { year, month, day, hour, minute, second }
}

/** `+HHMM` / `-HHMM` for the zone whose wall clock at `date` reads `p`. */
function offsetFromParts(date: Date, p: ClockParts): string {
  // Compare the UTC time to the timezone's wall-clock time
  const wallClock = dateFromParts(p.year, p.month - 1, p.day, p.hour, p.minute, p.second, 0, true)
  const offsetMs = wallClock.getTime() - Math.floor(date.getTime() / 1000) * 1000
  return offsetString(Math.round(offsetMs / 60000))
}

function offsetString(offsetMin: number): string {
  const sign = offsetMin >= 0 ? '+' : '-'
  const absMin = Math.abs(offsetMin)
  return `${sign}${pad(Math.floor(absMin / 60))}${pad(absMin % 60)}`
}

type NameOptions = Pick<Intl.DateTimeFormatOptions, 'month' | 'weekday'>

/**
 * The value of one format token. Month and weekday names are only looked up
 * when the format string asks for them: a numeric `YYYY-MM-DD HH:mm` needs no
 * locale data at all.
 */
function tokenValue(token: string, p: ClockParts, name: (options: NameOptions) => string, offset: () => string): string {
  const hours12 = p.hour % 12 || 12
  switch (token) {
    case 'YYYY': return pad(p.year, 4)
    case 'YY': return pad(p.year % 100)
    case 'MMMM': return name({ month: 'long' })
    case 'MMM': return name({ month: 'short' })
    case 'MM': return pad(p.month)
    case 'M': return String(p.month)
    case 'DD': return pad(p.day)
    case 'D': return String(p.day)
    case 'dddd': return name({ weekday: 'long' })
    case 'ddd': return name({ weekday: 'short' })
    case 'd': return name({ weekday: 'narrow' })
    case 'HH': return pad(p.hour)
    case 'H': return String(p.hour)
    case 'hh': return pad(hours12)
    case 'h': return String(hours12)
    case 'mm': return pad(p.minute)
    case 'm': return String(p.minute)
    case 'ss': return pad(p.second)
    case 's': return String(p.second)
    case 'A': return p.hour < 12 ? 'AM' : 'PM'
    case 'a': return p.hour < 12 ? 'am' : 'pm'
    case 'Z': return offset()
    default: return token
  }
}

// Build regex matching all tokens, longest first
const TOKEN_KEYS = ['YYYY', 'MMMM', 'dddd', 'MMM', 'ddd', 'YY', 'MM', 'DD', 'HH', 'hh', 'mm', 'ss', 'M', 'D', 'd', 'H', 'h', 'm', 's', 'A', 'a', 'Z']
const TOKEN_PATTERN = new RegExp(
  TOKEN_KEYS
    .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|'),
  'g',
)

/**
 * Format a date using token-based format strings.
 *
 * Supported tokens:
 * - YYYY: 4-digit year
 * - YY: 2-digit year
 * - MMMM: Full month name (January)
 * - MMM: Short month name (Jan)
 * - MM: 2-digit month (01-12)
 * - M: Month (1-12)
 * - DD: 2-digit day (01-31)
 * - D: Day (1-31)
 * - dddd: Full weekday name (Wednesday)
 * - ddd: Short weekday name (Wed)
 * - d: Narrow weekday (W)
 * - HH: 24-hour padded (00-23)
 * - H: 24-hour (0-23)
 * - hh: 12-hour padded (01-12)
 * - h: 12-hour (1-12)
 * - mm: Minutes padded (00-59)
 * - m: Minutes (0-59)
 * - ss: Seconds padded (00-59)
 * - s: Seconds (0-59)
 * - A: AM/PM
 * - a: am/pm
 * - Z: Timezone offset (+0800)
 *
 * @param inputDate - A Date object or ISO 8601 string
 * @param formatStr - Token-based format string (default: 'YYYY-MM-DD')
 * @param localeOrOptions - A locale string or options object with locale and tz (IANA timezone)
 */
export function format(inputDate: DateInput, formatStr = 'YYYY-MM-DD', localeOrOptions: string | FormatOptions = 'en'): string {
  const date = toDate(inputDate)
  const opts = typeof localeOrOptions === 'string' ? { locale: localeOrOptions } : localeOrOptions
  const locale = opts.locale ?? 'en'
  const tz = opts.tz

  if (tz) {
    const parts = getPartsInTz(date, tz)
    const name = (options: NameOptions) => zonedFormatter(locale, { timeZone: tz, ...options }).format(date)
    return formatStr.replace(TOKEN_PATTERN, match => tokenValue(match, parts, name, () => offsetFromParts(date, parts)))
  }

  // Local-time fast path (no Intl overhead for numeric parts). Names use a
  // fresh formatter: one without a zone reads the process zone when built.
  const parts: ClockParts = {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
    second: date.getSeconds(),
  }
  const name = (options: NameOptions) => new Intl.DateTimeFormat(locale, options).format(date)
  return formatStr.replace(TOKEN_PATTERN, match => tokenValue(match, parts, name, () => offsetString(-date.getTimezoneOffset())))
}
