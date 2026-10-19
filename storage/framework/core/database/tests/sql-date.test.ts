import { describe, expect, test } from 'bun:test'
import { parseSqlDate } from '../src/sql-helpers'

/**
 * A DATE column comes back from the driver as a JS Date at UTC midnight (Bun's
 * Postgres driver) or at the host's local midnight (others). Both must read as
 * the stored day on every host zone; run this file with TZ=Europe/Berlin and
 * TZ=America/Los_Angeles to see both halves of the bug it guards.
 */
describe('parseSqlDate', () => {
  test('reads a local-midnight Date from its local fields', () => {
    expect(parseSqlDate(new Date(2026, 9, 18))).toBe('2026-10-18')
    expect(parseSqlDate(new Date(2028, 1, 29))).toBe('2028-02-29')
  })

  test('reads a UTC-midnight Date from its UTC fields', () => {
    expect(parseSqlDate(new Date('2026-10-18T00:00:00Z'))).toBe('2026-10-18')
    expect(parseSqlDate(new Date('2026-01-01T00:00:00Z'))).toBe('2026-01-01')
  })

  test('keeps the date part of a string as written', () => {
    expect(parseSqlDate('2026-10-18')).toBe('2026-10-18')
    expect(parseSqlDate('2026-10-18 00:00:00')).toBe('2026-10-18')
    expect(parseSqlDate('2026-10-18T00:00:00.000Z')).toBe('2026-10-18')
    expect(parseSqlDate(' 2026-10-18 ')).toBe('2026-10-18')
  })

  test('returns null for anything that is not a real day', () => {
    expect(parseSqlDate(null)).toBeNull()
    expect(parseSqlDate(undefined)).toBeNull()
    expect(parseSqlDate('')).toBeNull()
    expect(parseSqlDate('2026-02-31')).toBeNull()
    expect(parseSqlDate('18/10/2026')).toBeNull()
    expect(parseSqlDate('2026-10-180')).toBeNull()
    expect(parseSqlDate(new Date(Number.NaN))).toBeNull()
    expect(parseSqlDate(1_700_000_000_000)).toBeNull()
  })
})
