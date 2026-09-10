/**
 * Calendar versioning (stacksjs/stacks#475).
 *
 * `YYYY.M.N` - the year, the month, and a counter that resets each month. It
 * looks like CalVer and it IS valid semver, which is the constraint that
 * decides the shape: npm, Bun and every range operator in a `package.json`
 * parse `major.minor.patch` and nothing else. A scheme like `2026.09.10` fails
 * on the leading zero, and `2026.9.10-1` is a prerelease rather than a release.
 *
 * The counter is not the day. A day is the wrong unit for a release counter:
 * two releases on one day would collide, and a month with releases on the 3rd
 * and the 20th would jump the version by 17 for no reason a reader could act
 * on. `N` counts releases within the month.
 */

export interface CalendarVersionParts {
  year: number
  month: number
  sequence: number
}

/** Parse `YYYY.M.N`, or `null` if this is not one. */
export function parseCalendarVersion(version: string): CalendarVersionParts | null {
  // Four-digit year, so a semver release like `0.74.41` is not mistaken for a
  // calendar one and silently continued as `0.74.42`.
  //
  // No leading zeros, because semver forbids them in a numeric identifier -
  // `2026.09.1` is not a version npm ever accepted, so it is not one this
  // scheme produced, and continuing its sequence would be reading meaning into
  // a string that never published.
  const match = version.match(/^(\d{4})\.(0|[1-9]\d?)\.(0|[1-9]\d*)$/)
  if (!match)
    return null

  const month = Number(match[2])
  if (month < 1 || month > 12)
    return null

  return { year: Number(match[1]), month, sequence: Number(match[3]) }
}

/**
 * The next calendar version, given the current one and the current date.
 *
 * - Same month as the current version: the sequence increments.
 * - A different month, or a version that is not calendar-shaped at all: the
 *   sequence restarts at 0.
 *
 * Never returns a version that does not sort ABOVE `current`. A clock that is
 * behind - a runner in another timezone, a machine whose time drifted - would
 * otherwise produce a version npm rejects, and the error at that point names
 * the registry rather than the clock. Instead the sequence keeps climbing
 * within the current version's own month, which is always publishable and
 * visibly wrong to a human reading the tag.
 */
export function nextCalendarVersion(current: string | undefined, now: Date = new Date()): string {
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth() + 1

  const parsed = current ? parseCalendarVersion(current) : null

  if (!parsed)
    return `${year}.${month}.0`

  // The current version is from a later month than "now". Rather than emit
  // something lower, continue that month's sequence.
  if (parsed.year > year || (parsed.year === year && parsed.month > month))
    return `${parsed.year}.${parsed.month}.${parsed.sequence + 1}`

  if (parsed.year === year && parsed.month === month)
    return `${year}.${month}.${parsed.sequence + 1}`

  return `${year}.${month}.0`
}

/** The `--bump` values that mean "compute a calendar version". */
export const CALENDAR_BUMPS: ReadonlySet<string> = new Set(['calendar', 'calver', 'date'])

/** Whether this `--bump` argument asks for a calendar version. */
export function isCalendarBump(bump: string | null | undefined): boolean {
  return typeof bump === 'string' && CALENDAR_BUMPS.has(bump.toLowerCase())
}
