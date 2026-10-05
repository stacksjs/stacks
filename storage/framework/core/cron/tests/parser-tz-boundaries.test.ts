import { describe, expect, it } from 'bun:test'
import { parse, parseCron } from '../src'

/**
 * Timezone schedules land on the local time they name.
 *
 * The search skipped in UTC units - to 00:00 UTC on the next day or month,
 * to the next UTC hour - and a zone's local boundaries are not there:
 *
 * - west of UTC a day skip landed at 17:00 local, past 09:00, so
 *   `0 9 1 * *` in Los Angeles never matched;
 * - in a half-hour zone every hour skip landed on :30, so `0 9 * * *` in
 *   India never matched;
 * - east of UTC a month skip landed after local midnight, so `0 0 1 3 *` in
 *   Tokyo slipped a whole year.
 */
function local(date: Date | null, tz: string): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date!)
}

describe('parseCron in a timezone', () => {
  it('finds 09:00 on the 1st west of UTC', () => {
    const next = parseCron('0 9 1 * *', new Date('2026-10-15T12:00:00Z'), { tz: 'America/Los_Angeles' })
    expect(local(next, 'America/Los_Angeles')).toBe('2026-11-01 09:00')
  })

  it('finds 09:00 in a half-hour zone', () => {
    const next = parseCron('0 9 * * *', new Date('2026-10-05T00:00:00Z'), { tz: 'Asia/Kolkata' })
    expect(local(next, 'Asia/Kolkata')).toBe('2026-10-05 09:00')
  })

  it('finds midnight on 1 March east of UTC, this year rather than next', () => {
    const next = parseCron('0 0 1 3 *', new Date('2026-01-10T00:00:00Z'), { tz: 'Asia/Tokyo' })
    expect(local(next, 'Asia/Tokyo')).toBe('2026-03-01 00:00')
  })

  it('crosses a DST change without losing the hour', () => {
    // Clocks go forward 02:00 -> 03:00 on 2026-03-08 in Los Angeles.
    const next = parseCron('30 3 * * *', new Date('2026-03-08T08:00:00Z'), { tz: 'America/Los_Angeles' })
    expect(local(next, 'America/Los_Angeles')).toBe('2026-03-08 03:30')
  })

  it('keeps the OR between day-of-month and day-of-week', () => {
    // The 15th, or any Monday: from Saturday 2026-10-10, Monday the 12th comes first.
    const next = parseCron('0 12 15 * 1', new Date('2026-10-10T00:00:00Z'), { tz: 'Europe/Berlin' })
    expect(local(next, 'Europe/Berlin')).toBe('2026-10-12 12:00')
  })
})

describe('parse', () => {
  it('honours tz even where Bun has a native parser', () => {
    const next = parse('0 9 * * *', new Date('2026-10-04T20:00:00Z'), { tz: 'Asia/Tokyo' })
    expect(local(next, 'Asia/Tokyo')).toBe('2026-10-05 09:00')
  })
})
