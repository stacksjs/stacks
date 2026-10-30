import { describe, expect, test } from 'bun:test'
import { parseCron } from '../src/parser'

// stacksjs/stacks#1877 Cr-6 accepted a leading seconds field by dropping it,
// warning only when it was neither 0 nor *. Dropping `*` is not harmless: it
// means every second, and came out every minute without a word. This parser has
// minute resolution, so a seconds field is accepted only as 0, which is the
// five-field expression after it, matching the scheduler's `.cron()`.

describe('parseCron and a leading seconds field', () => {
  test('accepts seconds of 0 as the five-field expression after it', () => {
    const fromSix = parseCron('0 0 12 * * *', new Date('2026-01-01T00:00:00Z'))
    const fromFive = parseCron('0 12 * * *', new Date('2026-01-01T00:00:00Z'))
    expect(fromSix).not.toBeNull()
    expect(fromSix!.getTime()).toBe(fromFive!.getTime())
  })

  test('refuses any seconds it would have to drop, rather than run at another time', () => {
    for (const expression of ['* * * * * *', '*/5 * * * * *', '30 0 12 * * *', '* 5 11 * * *'])
      expect(() => parseCron(expression, new Date('2026-01-01T00:00:00Z'))).toThrow(/runs on seconds/)
  })

  test('throws for non-5-and-non-6 field counts', () => {
    expect(() => parseCron('* * *', new Date('2026-01-01T00:00:00Z'))).toThrow(/expected 5 fields/i)
    expect(() => parseCron('* * * * * * *', new Date('2026-01-01T00:00:00Z'))).toThrow(/expected 5 fields/i)
  })
})
