export interface FormatTimeAgoOptions {
  /** Maximum unit to use. Default: 'year' */
  max?: 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year'
  /** Use full words instead of abbreviations. Default: true */
  fullDateFormatter?: (date: Date) => string
  /** Custom messages */
  messages?: Partial<{
    justNow: string
    past: (n: string) => string
    future: (n: string) => string
    second: (n: number) => string
    minute: (n: number) => string
    hour: (n: number) => string
    day: (n: number) => string
    week: (n: number) => string
    month: (n: number) => string
    year: (n: number) => string
  }>
}

const defaultMessages = {
  justNow: 'just now',
  past: (n: string) => `${n} ago`,
  future: (n: string) => `in ${n}`,
  second: (n: number) => `${n} second${n > 1 ? 's' : ''}`,
  minute: (n: number) => `${n} minute${n > 1 ? 's' : ''}`,
  hour: (n: number) => `${n} hour${n > 1 ? 's' : ''}`,
  day: (n: number) => `${n} day${n > 1 ? 's' : ''}`,
  week: (n: number) => `${n} week${n > 1 ? 's' : ''}`,
  month: (n: number) => `${n} month${n > 1 ? 's' : ''}`,
  year: (n: number) => `${n} year${n > 1 ? 's' : ''}`,
}

/**
 * Format a date to a human-readable time-ago string.
 *
 * @param date - The date to format
 * @param options - Formatting options
 */
export function formatTimeAgo(
  date: Date | number | string,
  options: FormatTimeAgoOptions = {},
): string {
  const messages = { ...defaultMessages, ...options.messages }
  const d = date instanceof Date ? date : new Date(date)
  const now = Date.now()
  const diff = now - d.getTime()
  const absDiff = Math.abs(diff)

  const seconds = Math.floor(absDiff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const weeks = Math.floor(days / 7)
  const months = Math.floor(days / 30)
  const years = Math.floor(days / 365)

  const isFuture = diff < 0

  function format(value: string): string {
    return isFuture ? messages.future(value) : messages.past(value)
  }

  if (seconds < 5)
    return messages.justNow
  if (seconds < 60)
    return format(messages.second(seconds))
  if (minutes < 60)
    return format(messages.minute(minutes))
  if (hours < 24)
    return format(messages.hour(hours))
  if (days < 7)
    return format(messages.day(days))
  if (weeks < 4)
    return format(messages.week(weeks))
  if (months < 12)
    return format(messages.month(months))
  return format(messages.year(years))
}
