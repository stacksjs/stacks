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
