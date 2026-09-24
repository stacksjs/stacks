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

  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
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
 * A time that does not exist (skipped by a spring-forward) resolves to the
 * instant just after the gap; a time that happens twice (the fall-back hour)
 * resolves to the first of them, which is what a box office means by it.
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
  const guess = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s))

  // Two passes: the offset at the naive guess can differ from the offset at
  // the answer when a DST change falls between them.
  const first = guess - zoneOffsetMinutes(new Date(guess), timeZone) * 60_000
  const second = guess - zoneOffsetMinutes(new Date(first), timeZone) * 60_000
  if (second === first)
    return new Date(second)

  // The passes disagree only around a transition. Prefer the earlier reading
  // that actually shows the requested wall-clock time (the first of a
  // repeated hour); if neither does, the time fell in a gap.
  const [early, late] = first < second ? [first, second] : [second, first]
  if (early + zoneOffsetMinutes(new Date(early), timeZone) * 60_000 === guess)
    return new Date(early)
  return new Date(late)
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
