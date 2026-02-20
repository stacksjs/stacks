type DateInput = Date | string

interface FormatOptions {
  locale?: string
  tz?: string
}

function toDate(input: DateInput): Date {
  if (input instanceof Date) return input
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${input}`)
  return d
}

function pad(n: number, len = 2): string {
  return String(n).padStart(len, '0')
}

/**
 * Extract individual date/time parts for a given timezone using Intl.DateTimeFormat.
 * Returns numeric values for year, month, day, hour, minute, second, and weekday.
 */
function getPartsInTz(date: Date, tz: string, locale: string): {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
  weekday: string
  weekdayShort: string
  weekdayNarrow: string
  monthLong: string
  monthShort: string
  tzOffset: string
} {
  // Extract numeric parts
  const numFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  const parts = numFmt.formatToParts(date)
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? ''

  const year = Number.parseInt(get('year'), 10)
  const month = Number.parseInt(get('month'), 10)
  const day = Number.parseInt(get('day'), 10)
  let hour = Number.parseInt(get('hour'), 10)
  // Intl may return 24 for midnight in some locales
  if (hour === 24) hour = 0
  const minute = Number.parseInt(get('minute'), 10)
  const second = Number.parseInt(get('second'), 10)

  // Named parts need the actual target locale
  const weekday = new Intl.DateTimeFormat(locale, { timeZone: tz, weekday: 'long' }).format(date)
  const weekdayShort = new Intl.DateTimeFormat(locale, { timeZone: tz, weekday: 'short' }).format(date)
  const weekdayNarrow = new Intl.DateTimeFormat(locale, { timeZone: tz, weekday: 'narrow' }).format(date)
  const monthLong = new Intl.DateTimeFormat(locale, { timeZone: tz, month: 'long' }).format(date)
  const monthShort = new Intl.DateTimeFormat(locale, { timeZone: tz, month: 'short' }).format(date)

  // Compute the offset for this timezone at this instant
  // We do this by comparing the UTC time to the timezone's wall-clock time
  const utcFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const utcParts = utcFmt.formatToParts(date)
  const getUtc = (type: string) => utcParts.find(p => p.type === type)?.value ?? ''
  const utcDate = new Date(
    Date.UTC(
      Number.parseInt(getUtc('year'), 10),
      Number.parseInt(getUtc('month'), 10) - 1,
      Number.parseInt(getUtc('day'), 10),
      Number.parseInt(getUtc('hour'), 10) === 24 ? 0 : Number.parseInt(getUtc('hour'), 10),
      Number.parseInt(getUtc('minute'), 10),
      Number.parseInt(getUtc('second'), 10),
    ),
  )
  const tzDate = new Date(
    Date.UTC(year, month - 1, day, hour, minute, second),
  )
  const offsetMs = tzDate.getTime() - utcDate.getTime()
  const offsetMin = Math.round(offsetMs / 60000)
  const sign = offsetMin >= 0 ? '+' : '-'
  const absMin = Math.abs(offsetMin)
  const tzOffset = `${sign}${pad(Math.floor(absMin / 60))}${pad(absMin % 60)}`

  return { year, month, day, hour, minute, second, weekday, weekdayShort, weekdayNarrow, monthLong, monthShort, tzOffset }
}

function buildTokens(p: ReturnType<typeof getPartsInTz>): Record<string, string> {
  const hours12 = p.hour % 12 || 12
  return {
    YYYY: String(p.year),
    YY: String(p.year).slice(-2),
    MMMM: p.monthLong,
    MMM: p.monthShort,
    MM: pad(p.month),
    M: String(p.month),
    DD: pad(p.day),
    D: String(p.day),
    dddd: p.weekday,
    ddd: p.weekdayShort,
    d: p.weekdayNarrow,
    HH: pad(p.hour),
    H: String(p.hour),
    hh: pad(hours12),
    h: String(hours12),
    mm: pad(p.minute),
    m: String(p.minute),
    ss: pad(p.second),
    s: String(p.second),
    A: p.hour < 12 ? 'AM' : 'PM',
    a: p.hour < 12 ? 'am' : 'pm',
    Z: p.tzOffset,
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
    const parts = getPartsInTz(date, tz, locale)
    const tokens = buildTokens(parts)
    return formatStr.replace(TOKEN_PATTERN, match => tokens[match] ?? match)
  }

  // Local-time fast path (no Intl overhead for numeric parts)
  const hours24 = date.getHours()
  const hours12 = hours24 % 12 || 12

  const tokens: Record<string, string> = {
    YYYY: String(date.getFullYear()),
    YY: String(date.getFullYear()).slice(-2),
    MMMM: new Intl.DateTimeFormat(locale, { month: 'long' }).format(date),
    MMM: new Intl.DateTimeFormat(locale, { month: 'short' }).format(date),
    MM: pad(date.getMonth() + 1),
    M: String(date.getMonth() + 1),
    DD: pad(date.getDate()),
    D: String(date.getDate()),
    dddd: new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(date),
    ddd: new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date),
    d: new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(date),
    HH: pad(hours24),
    H: String(hours24),
    hh: pad(hours12),
    h: String(hours12),
    mm: pad(date.getMinutes()),
    m: String(date.getMinutes()),
    ss: pad(date.getSeconds()),
    s: String(date.getSeconds()),
    A: hours24 < 12 ? 'AM' : 'PM',
    a: hours24 < 12 ? 'am' : 'pm',
    Z: (() => {
      const offset = -date.getTimezoneOffset()
      const sign = offset >= 0 ? '+' : '-'
      const abs = Math.abs(offset)
      return `${sign}${pad(Math.floor(abs / 60))}${pad(abs % 60)}`
    })(),
  }

  return formatStr.replace(TOKEN_PATTERN, match => tokens[match] ?? match)
}
