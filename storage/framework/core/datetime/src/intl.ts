/**
 * Shared `Intl.DateTimeFormat` instances for formatters that name their zone.
 *
 * Building a formatter makes ICU resolve the locale and load the zone's rules,
 * about 0.1 ms each, while formatting with a built one costs microseconds.
 * `format(date, 'YYYY-MM-DD HH:mm', { tz })` used to build six per call, so a
 * server rendering a timetable spent most of a request in constructors (a 70
 * session schedule: ~70 ms of a ~110 ms response).
 *
 * Only formatters with an explicit `timeZone` are shared. One without reads the
 * process zone when it is built, and a later change to `TZ` must still apply.
 * An unknown zone or locale throws from the constructor, so nothing is stored
 * for it and every call keeps throwing the same `RangeError`.
 */

const MAX_FORMATTERS = 512
const formatters = new Map<string, Intl.DateTimeFormat>()

export function zonedFormatter(locale: string, options: Intl.DateTimeFormatOptions & { timeZone: string }): Intl.DateTimeFormat {
  const key = `${locale}\u0000${JSON.stringify(options)}`
  const cached = formatters.get(key)
  if (cached)
    return cached

  const formatter = new Intl.DateTimeFormat(locale, options)
  // Zones and locales can come from user input, so the cache is bounded:
  // the oldest entry makes room (Map iterates in insertion order).
  if (formatters.size >= MAX_FORMATTERS)
    formatters.delete(formatters.keys().next().value!)
  formatters.set(key, formatter)
  return formatter
}

/** How many formatters are shared right now (for tests). */
export function sharedFormatterCount(): number {
  return formatters.size
}
