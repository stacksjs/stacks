/**
 * Wall-clock time in a named zone, to and from an instant.
 *
 * Event data usually arrives as the time printed on the ticket: Bandsintown,
 * Eventbrite and most box-office feeds publish `2026-10-01T20:00:00` with no
 * offset and mean 8pm wherever the venue is. `new Date()` reads that string in
 * the SERVER's zone, so a calendar feed or a schema.org `startDate` built from
 * it is off by however far the server sits from the venue, and a tour that
 * crosses zones is wrong by a different amount at every stop.
 *
 * These two helpers turn the printed time into the real instant and back,
 * with nothing but `Intl`, so DST rules come from the runtime's tz database.
 */

const DAY_MS = 86_400_000
const WALL_CLOCK = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/

/** Offset of `timeZone` from UTC at `instant`, in minutes (New York in July: -240). */
export function zoneOffsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant)
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value ?? 0)

  // setUTCFullYear keeps years below 100 literal; Date.UTC would remap 0050 to 1950.
  const reading = new Date(Date.UTC(2000, get('month') - 1, get('day'), get('hour'), get('minute'), get('second')))
  reading.setUTCFullYear(get('year'))
  const asUtc = reading.getTime()
  // Drop sub-second precision so the difference is whole minutes.
  const whole = Math.floor(instant.getTime() / 1000) * 1000
  return Math.round((asUtc - whole) / 60_000)
}

/**
 * The instant at which clocks in `timeZone` read `wallClock`.
 *
 * `wallClock` is `YYYY-MM-DD`, `YYYY-MM-DDTHH:mm` or `YYYY-MM-DDTHH:mm:ss`,
 * with no offset. A string that carries its own offset is already an instant,
 * so it is rejected rather than silently reinterpreted.
 *
 * Around a DST change the rule is the same in every zone (it is RFC 5545's and
 * Temporal's `'compatible'` disambiguation):
 *
 * - A time that happens twice (the fall-back hour) resolves to the EARLIER of
 *   the two instants, which is what a box office means by it. Berlin's
 *   `2026-10-25T02:30` is `00:30Z` (`+02:00`), not `01:30Z` (`+01:00`).
 * - A time that never happens (skipped by a spring-forward) is read with the
 *   offset in force before the gap, so it lands as far past the gap as it was
 *   into it. Berlin's `2026-03-29T02:30` is `01:30Z`, which clocks there show
 *   as `03:30`; New York's `2026-03-08T02:30` likewise shows as `03:30`.
 *
 * @example
 * zonedTimeToUtc('2026-10-01T20:00:00', 'America/New_York').toISOString()
 * // '2026-10-02T00:00:00.000Z'
 */
export function zonedTimeToUtc(wallClock: string, timeZone: string): Date {
  const match = WALL_CLOCK.exec(wallClock.trim())
  if (!match)
    throw new TypeError(`zonedTimeToUtc expects a wall-clock time like 2026-10-01T20:00:00, got "${wallClock}"`)

  const [, y, mo, d, h = '0', mi = '0', s = '0'] = match
  // The wall-clock reading as if it were UTC. setUTCFullYear keeps years below
  // 100 literal, where Date.UTC would remap 0050 to 1950.
  const reading = new Date(Date.UTC(2000, Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)))
  reading.setUTCFullYear(Number(y))
  const local = reading.getTime()

  // A zone's offset changes at most once in any day, so the offsets a day
  // either side are the only two the answer can carry.
  const before = zoneOffsetMinutes(new Date(local - DAY_MS), timeZone)
  const after = zoneOffsetMinutes(new Date(local + DAY_MS), timeZone)

  // Each candidate offset gives an instant; keep the ones at which the zone
  // really shows the requested reading. Two survivors mean a repeated hour.
  const shows = (offset: number): number | null => {
    const instant = local - offset * 60_000
    return zoneOffsetMinutes(new Date(instant), timeZone) === offset ? instant : null
  }
  const valid = [shows(before), shows(after)].filter((instant): instant is number => instant !== null)
  if (valid.length)
    return new Date(Math.min(...valid))

  // Neither offset shows it: the reading fell in a spring-forward gap.
  return new Date(local - before * 60_000)
}

/**
 * ISO 8601 with the zone's offset rather than `Z`: `2026-10-01T20:00:00-04:00`.
 *
 * This is the form schema.org Event `startDate` wants. A bare local time is
 * ambiguous and a `Z` time shows the wrong hour to anyone who reads it.
 */
export function isoInZone(instant: Date, timeZone: string): string {
  const offset = zoneOffsetMinutes(instant, timeZone)
  const local = new Date(Math.floor(instant.getTime() / 1000) * 1000 + offset * 60_000)
  const sign = offset < 0 ? '-' : '+'
  const abs = Math.abs(offset)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${local.toISOString().slice(0, 19)}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
}
