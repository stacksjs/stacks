/**
 * Read a date value from a dashboard row.
 *
 * A calendar date (`2026-10-01`) is a day, not an instant, so it is read as
 * local midnight. `new Date('2026-10-01')` reads it as UTC midnight instead,
 * which every zone west of UTC renders as the day before: a coupon starting
 * on October 1st showed September 30th in Los Angeles.
 *
 * A database timestamp written without an offset (`2026-10-01 14:30:00`) is
 * UTC, which is how the framework writes it, so it gains the `Z` it lacks.
 * Anything else, ISO strings with an offset among them, is left to `Date`.
 */
export function parseDashboardDate(value: unknown): Date {
  if (value instanceof Date)
    return value
  const text = String(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(text))
    return new Date(`${text}T00:00:00`)
  if (/^\d{4}-\d{2}-\d{2} \d/.test(text))
    return new Date(`${text.replace(' ', 'T')}Z`)
  return new Date(text)
}
