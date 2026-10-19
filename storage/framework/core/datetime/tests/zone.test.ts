import { describe, expect, it } from 'bun:test'
import { isoInZone, zonedTimeToUtc, zoneOffsetMinutes } from '../src'

describe('zonedTimeToUtc', () => {
  it('reads a box-office time in the venue zone, not the server zone', () => {
    // Comix at Mohegan Sun, Montville CT: 8pm Eastern daylight time.
    expect(zonedTimeToUtc('2026-10-01T20:00:00', 'America/New_York').toISOString()).toBe('2026-10-02T00:00:00.000Z')
    // Same printed time, other side of the country and of the DST change.
    expect(zonedTimeToUtc('2027-01-08T19:00:00', 'America/Los_Angeles').toISOString()).toBe('2027-01-09T03:00:00.000Z')
  })

  it('handles a zone with no DST', () => {
    expect(zonedTimeToUtc('2026-11-06T19:00', 'America/Phoenix').toISOString()).toBe('2026-11-07T02:00:00.000Z')
  })

  it('accepts a bare date as local midnight', () => {
    expect(zonedTimeToUtc('2026-07-01', 'Europe/Berlin').toISOString()).toBe('2026-06-30T22:00:00.000Z')
  })

  it('takes the first of a repeated fall-back hour', () => {
    // 2026-11-01 01:30 happens twice in New York; the first is EDT (-04:00).
    expect(zonedTimeToUtc('2026-11-01T01:30:00', 'America/New_York').toISOString()).toBe('2026-11-01T05:30:00.000Z')
  })

  it('moves a time inside a spring-forward gap past the gap', () => {
    // 2027-03-14 02:30 does not exist in New York.
    const instant = zonedTimeToUtc('2027-03-14T02:30:00', 'America/New_York')
    expect(isoInZone(instant, 'America/New_York')).toBe('2027-03-14T03:30:00-04:00')
  })

  it('takes the earlier instant of a repeated hour in every zone (2026 EU and US fall-back)', () => {
    // Europe moves back at 01:00Z on 2026-10-25; 02:30 happens at +02:00 then at +01:00.
    expect(zonedTimeToUtc('2026-10-25T02:30:00', 'Europe/Berlin').toISOString()).toBe('2026-10-25T00:30:00.000Z')
    expect(zonedTimeToUtc('2026-10-25T01:30:00', 'Europe/London').toISOString()).toBe('2026-10-25T00:30:00.000Z')
    expect(zonedTimeToUtc('2026-10-25T03:30:00', 'Europe/Helsinki').toISOString()).toBe('2026-10-25T00:30:00.000Z')
    // The US moves back on 2026-11-01; 01:30 is first EDT/CDT/PDT.
    expect(zonedTimeToUtc('2026-11-01T01:30:00', 'America/Chicago').toISOString()).toBe('2026-11-01T06:30:00.000Z')
    expect(zonedTimeToUtc('2026-11-01T01:30:00', 'America/Los_Angeles').toISOString()).toBe('2026-11-01T08:30:00.000Z')
    // Southern hemisphere: Sydney moves back on 2026-04-05.
    expect(zonedTimeToUtc('2026-04-05T02:30:00', 'Australia/Sydney').toISOString()).toBe('2026-04-04T15:30:00.000Z')
  })

  it('leaves the edges of a repeated hour alone', () => {
    expect(isoInZone(zonedTimeToUtc('2026-10-25T01:59:59', 'Europe/Berlin'), 'Europe/Berlin')).toBe('2026-10-25T01:59:59+02:00')
    expect(isoInZone(zonedTimeToUtc('2026-10-25T03:00:00', 'Europe/Berlin'), 'Europe/Berlin')).toBe('2026-10-25T03:00:00+01:00')
  })

  it('shifts a skipped time forward by the gap in every zone (2026 EU and US spring-forward)', () => {
    // Europe jumps 02:00 -> 03:00 on 2026-03-29; 02:30 reads with the +01:00 in force before the gap.
    const berlin = zonedTimeToUtc('2026-03-29T02:30:00', 'Europe/Berlin')
    expect(berlin.toISOString()).toBe('2026-03-29T01:30:00.000Z')
    expect(isoInZone(berlin, 'Europe/Berlin')).toBe('2026-03-29T03:30:00+02:00')
    expect(isoInZone(zonedTimeToUtc('2026-03-29T01:15:00', 'Europe/London'), 'Europe/London')).toBe('2026-03-29T02:15:00+01:00')
    // The US jumps 02:00 -> 03:00 on 2026-03-08.
    const newYork = zonedTimeToUtc('2026-03-08T02:30:00', 'America/New_York')
    expect(newYork.toISOString()).toBe('2026-03-08T07:30:00.000Z')
    expect(isoInZone(newYork, 'America/New_York')).toBe('2026-03-08T03:30:00-04:00')
    expect(isoInZone(zonedTimeToUtc('2026-03-08T02:00:00', 'America/Denver'), 'America/Denver')).toBe('2026-03-08T03:00:00-06:00')
  })

  it('reads ordinary times on transition days at the right offset', () => {
    expect(zonedTimeToUtc('2026-03-29T01:59:00', 'Europe/Berlin').toISOString()).toBe('2026-03-29T00:59:00.000Z')
    expect(zonedTimeToUtc('2026-03-29T03:00:00', 'Europe/Berlin').toISOString()).toBe('2026-03-29T01:00:00.000Z')
    expect(zonedTimeToUtc('2026-10-25T12:00:00', 'Europe/Berlin').toISOString()).toBe('2026-10-25T11:00:00.000Z')
    expect(zonedTimeToUtc('2026-03-08T12:00:00', 'America/New_York').toISOString()).toBe('2026-03-08T16:00:00.000Z')
  })

  it('handles half-hour DST (Lord Howe) and years below 100', () => {
    // Lord Howe moves back 30 minutes at 02:00 on 2026-04-05; 01:45 happens at +11:00 then +10:30.
    expect(zonedTimeToUtc('2026-04-05T01:45:00', 'Australia/Lord_Howe').toISOString()).toBe('2026-04-04T14:45:00.000Z')
    expect(zonedTimeToUtc('0050-06-01T12:00:00', 'UTC').toISOString()).toBe('0050-06-01T12:00:00.000Z')
  })

  it('refuses a string that already carries an offset', () => {
    expect(() => zonedTimeToUtc('2026-10-01T20:00:00Z', 'America/New_York')).toThrow(TypeError)
    expect(() => zonedTimeToUtc('2026-10-01T20:00:00-04:00', 'America/New_York')).toThrow(TypeError)
  })
})

describe('isoInZone', () => {
  it('prints the instant with the zone offset', () => {
    const instant = new Date('2026-10-02T00:00:00Z')
    expect(isoInZone(instant, 'America/New_York')).toBe('2026-10-01T20:00:00-04:00')
    expect(isoInZone(instant, 'Asia/Kolkata')).toBe('2026-10-02T05:30:00+05:30')
    expect(isoInZone(instant, 'UTC')).toBe('2026-10-02T00:00:00+00:00')
  })

  it('round-trips with zonedTimeToUtc', () => {
    for (const zone of ['America/Denver', 'Europe/London', 'Australia/Adelaide']) {
      const instant = zonedTimeToUtc('2027-02-20T21:30:00', zone)
      expect(isoInZone(instant, zone).slice(0, 19)).toBe('2027-02-20T21:30:00')
    }
  })
})

describe('zoneOffsetMinutes', () => {
  it('follows DST', () => {
    expect(zoneOffsetMinutes(new Date('2026-07-01T12:00:00Z'), 'America/Chicago')).toBe(-300)
    expect(zoneOffsetMinutes(new Date('2026-12-01T12:00:00Z'), 'America/Chicago')).toBe(-360)
  })
})
