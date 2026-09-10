import { describe, expect, it } from 'bun:test'
import { isCalendarBump, nextCalendarVersion, parseCalendarVersion } from '../src/calendar-version'

/**
 * Calendar versioning (stacksjs/stacks#475).
 *
 * The constraint that decides everything here is that the result must be valid
 * SEMVER: npm, Bun and every range operator parse `major.minor.patch` and
 * nothing else. A scheme that looks nicer and does not publish is not a
 * scheme.
 */

const at = (iso: string) => new Date(iso)

describe('parseCalendarVersion', () => {
  it('parses YYYY.M.N', () => {
    expect(parseCalendarVersion('2026.9.0')).toEqual({ year: 2026, month: 9, sequence: 0 })
    expect(parseCalendarVersion('2026.12.41')).toEqual({ year: 2026, month: 12, sequence: 41 })
  })

  it('requires a four-digit year, so a semver release is not mistaken for one', () => {
    // `0.74.41` would otherwise parse as year 0 month 74, and the next release
    // would silently continue a scheme nobody chose.
    expect(parseCalendarVersion('0.74.41')).toBeNull()
    expect(parseCalendarVersion('1.2.3')).toBeNull()
  })

  it('rejects an impossible month', () => {
    expect(parseCalendarVersion('2026.0.1')).toBeNull()
    expect(parseCalendarVersion('2026.13.1')).toBeNull()
  })

  it('rejects anything that is not exactly three numeric parts', () => {
    for (const version of ['2026.9', '2026.9.0.1', '2026.09.1', 'v2026.9.1', '2026.9.0-beta'])
      expect(parseCalendarVersion(version)).toBeNull()
  })
})

describe('nextCalendarVersion', () => {
  it('starts a fresh month at 0', () => {
    expect(nextCalendarVersion('2026.8.7', at('2026-09-10T12:00:00Z'))).toBe('2026.9.0')
  })

  it('increments within the same month', () => {
    expect(nextCalendarVersion('2026.9.0', at('2026-09-10T12:00:00Z'))).toBe('2026.9.1')
    expect(nextCalendarVersion('2026.9.41', at('2026-09-30T23:59:00Z'))).toBe('2026.9.42')
  })

  it('does not use the day as the counter', () => {
    // Two releases on one day would collide, and a month with releases on the
    // 3rd and the 20th would jump by 17 for no reason a reader could act on.
    expect(nextCalendarVersion('2026.9.1', at('2026-09-20T00:00:00Z'))).toBe('2026.9.2')
  })

  it('starts at 0 when moving from a semver scheme', () => {
    expect(nextCalendarVersion('0.74.41', at('2026-09-10T12:00:00Z'))).toBe('2026.9.0')
  })

  it('sorts above the semver version it replaces', () => {
    // 2026 > 0, so the switch is publishable. Asserted because if it were not,
    // the failure would arrive from the registry rather than from here.
    const next = nextCalendarVersion('0.74.41', at('2026-09-10T12:00:00Z'))
    expect(Number(next.split('.')[0])).toBeGreaterThan(0)
  })

  it('handles a missing current version', () => {
    expect(nextCalendarVersion(undefined, at('2026-01-05T00:00:00Z'))).toBe('2026.1.0')
  })

  it('never emits a version below the current one when the clock is behind', () => {
    // A runner in another timezone, or a machine whose time drifted. Emitting
    // a lower version produces an npm rejection that names the registry rather
    // than the clock.
    expect(nextCalendarVersion('2026.10.3', at('2026-09-10T12:00:00Z'))).toBe('2026.10.4')
    expect(nextCalendarVersion('2027.1.0', at('2026-12-31T23:00:00Z'))).toBe('2027.1.1')
  })

  it('crosses a year boundary', () => {
    expect(nextCalendarVersion('2026.12.9', at('2027-01-01T00:00:00Z'))).toBe('2027.1.0')
  })

  it('reads the date in UTC, so a release does not depend on the runner timezone', () => {
    // 2026-10-01T00:30Z is still September in UTC-8. Using local time would
    // make the version depend on where the release ran.
    expect(nextCalendarVersion('2026.9.1', at('2026-10-01T00:30:00Z'))).toBe('2026.10.0')
  })

  it('always produces valid semver', () => {
    const semver = /^\d+\.\d+\.\d+$/
    for (const [current, when] of [
      ['0.74.41', '2026-01-01T00:00:00Z'],
      ['2026.9.0', '2026-09-15T00:00:00Z'],
      [undefined, '2026-12-31T23:59:59Z'],
    ] as const)
      expect(nextCalendarVersion(current, at(when))).toMatch(semver)
  })
})

describe('isCalendarBump', () => {
  it('accepts the documented spellings, case-insensitively', () => {
    for (const bump of ['calendar', 'calver', 'date', 'CalVer', 'DATE'])
      expect(isCalendarBump(bump)).toBeTrue()
  })

  it('does not swallow a semver keyword or an explicit version', () => {
    for (const bump of ['patch', 'minor', 'major', '1.2.3', '', null, undefined])
      expect(isCalendarBump(bump)).toBeFalse()
  })
})
