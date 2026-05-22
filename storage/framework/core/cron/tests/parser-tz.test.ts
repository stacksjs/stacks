import { describe, expect, test } from 'bun:test'
import { parseCron } from '../src/parser'

// stacksjs/stacks#1877 Cr-5 — TZ-aware parser parameter. Pins that
// when `tz` is set, the cron expression is interpreted in that
// timezone's local time rather than UTC.

describe('parseCron with tz option (stacksjs/stacks#1877 Cr-5)', () => {
  test('without tz, "0 14 * * *" matches 14:00 UTC', () => {
    // Search starting just after midnight UTC — next 14:00 UTC is the same day.
    const start = new Date('2026-06-15T00:00:00Z')
    const next = parseCron('0 14 * * *', start)
    expect(next).not.toBeNull()
    expect(next!.toISOString()).toBe('2026-06-15T14:00:00.000Z')
  })

  test('with tz=America/Los_Angeles, "0 14 * * *" matches 14:00 PDT (21:00 UTC in summer)', () => {
    const start = new Date('2026-06-15T00:00:00Z')
    const next = parseCron('0 14 * * *', start, { tz: 'America/Los_Angeles' })
    expect(next).not.toBeNull()
    // June is PDT (UTC-7). 14:00 PDT = 21:00 UTC.
    expect(next!.toISOString()).toBe('2026-06-15T21:00:00.000Z')
  })

  test('with tz=America/Los_Angeles in winter, 14:00 PST = 22:00 UTC', () => {
    const start = new Date('2026-01-15T00:00:00Z')
    const next = parseCron('0 14 * * *', start, { tz: 'America/Los_Angeles' })
    expect(next).not.toBeNull()
    // January is PST (UTC-8). 14:00 PST = 22:00 UTC.
    expect(next!.toISOString()).toBe('2026-01-15T22:00:00.000Z')
  })

  test('with tz=Asia/Tokyo, "0 9 * * 1" matches 09:00 Mon JST', () => {
    // Start mid-Sunday UTC.
    const start = new Date('2026-06-14T00:00:00Z') // Sunday
    const next = parseCron('0 9 * * 1', start, { tz: 'Asia/Tokyo' })
    expect(next).not.toBeNull()
    // 09:00 JST Monday = 00:00 UTC Monday (JST is UTC+9).
    expect(next!.toISOString()).toBe('2026-06-15T00:00:00.000Z')
  })

  test('with tz=UTC, behaves the same as no tz', () => {
    const start = new Date('2026-03-10T00:00:00Z')
    const withTz = parseCron('30 8 * * *', start, { tz: 'UTC' })
    const withoutTz = parseCron('30 8 * * *', start)
    expect(withTz?.toISOString()).toBe(withoutTz?.toISOString())
  })

  test('day-of-week matches against the local weekday in tz', () => {
    // Saturday 23:00 UTC = Sunday 08:00 JST. A cron expression of
    // "* * * * 0" (Sundays) should match the next Sunday in JST,
    // which starts earlier in UTC than a UTC-relative interpretation.
    const start = new Date('2026-06-13T22:00:00Z') // Saturday 22:00 UTC = Sunday 07:00 JST
    const next = parseCron('0 8 * * 0', start, { tz: 'Asia/Tokyo' })
    expect(next).not.toBeNull()
    // Sunday 08:00 JST = Saturday 23:00 UTC.
    expect(next!.toISOString()).toBe('2026-06-13T23:00:00.000Z')
  })
})
