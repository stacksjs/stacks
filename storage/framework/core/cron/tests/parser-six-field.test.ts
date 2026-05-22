import { describe, expect, test } from 'bun:test'
import { parseCron } from '../src/parser'

// stacksjs/stacks#1877 Cr-6 — pins the contract that a 6-field cron
// expression (Quartz / Spring style with leading seconds) is parsed
// by stripping the seconds field instead of throwing. The seconds
// field is logged when non-zero/non-wildcard so the user knows
// their precision was silently lost.

describe('parseCron 6-field handling (stacksjs/stacks#1877 Cr-6)', () => {
  test('accepts 6-field expression and parses against the trailing 5 fields', () => {
    // Seconds=0 means "fire at the start of the matching minute" —
    // which is what the 5-field parser does by default. So this
    // should produce the same result as the equivalent 5-field
    // version.
    const fromSix = parseCron('0 0 12 * * *', new Date('2026-01-01T00:00:00Z'))
    const fromFive = parseCron('0 12 * * *', new Date('2026-01-01T00:00:00Z'))
    expect(fromSix).not.toBeNull()
    expect(fromFive).not.toBeNull()
    expect(fromSix!.getTime()).toBe(fromFive!.getTime())
  })

  test('throws for non-5-and-non-6 field counts', () => {
    expect(() => parseCron('* * *', new Date('2026-01-01T00:00:00Z'))).toThrow(/expected 5 fields/i)
    expect(() => parseCron('* * * * * * *', new Date('2026-01-01T00:00:00Z'))).toThrow(/expected 5 fields/i)
  })

  test('warns once per expression when seconds field is non-zero', () => {
    const orig = console.warn
    const warned: string[] = []
    console.warn = (msg: string) => {
      warned.push(String(msg))
    }
    try {
      // Same expression twice — should produce exactly one warn.
      parseCron('30 0 12 * * *', new Date('2026-01-01T00:00:00Z'))
      parseCron('30 0 12 * * *', new Date('2026-01-02T00:00:00Z'))
      expect(warned).toHaveLength(1)
      expect(warned[0]).toMatch(/seconds='30'/)
      expect(warned[0]).toMatch(/everySecond/i)
    }
    finally {
      console.warn = orig
    }
  })

  test('does NOT warn for seconds=0 or seconds=*', () => {
    const orig = console.warn
    const warned: string[] = []
    console.warn = (msg: string) => {
      warned.push(String(msg))
    }
    try {
      // Use unique expressions so we don't hit the deduped warn from
      // earlier tests.
      parseCron('0 5 11 * * *', new Date('2026-01-01T00:00:00Z'))
      parseCron('* 5 11 * * *', new Date('2026-01-01T00:00:00Z'))
      expect(warned).toHaveLength(0)
    }
    finally {
      console.warn = orig
    }
  })
})
