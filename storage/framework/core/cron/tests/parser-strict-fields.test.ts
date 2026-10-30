import { describe, expect, test } from 'bun:test'
import { parseCron } from '../src/parser'

/**
 * Found by running this parser against Bun.cron.parse over the same expressions
 * and start times. With the clock in UTC they agree everywhere except here, and
 * in each case this parser was the one that quietly did something else.
 */
const from = new Date('2026-10-30T12:34:56Z')
const next = (expression: string) => parseCron(expression, from)?.toISOString()

describe('parseCron reads every part of a field, not a prefix of it', () => {
  test('refuses Quartz syntax it does not have, instead of reading the leading number', () => {
    // parseInt('1W') and parseInt('1#2') are 1: these ran on the 1st and on
    // every Monday.
    expect(() => next('0 0 1W * *')).toThrow('Invalid cron value: 1W')
    expect(() => next('0 0 * * 1#2')).toThrow('Invalid cron value: 1#2')
    expect(() => next('0 0 L * *')).toThrow('Invalid cron value')
    expect(() => next('0 0 * * MON-')).toThrow('Invalid cron value')
  })

  test('refuses a range that runs backwards, which would never run', () => {
    expect(() => next('0 22-2 * * *')).toThrow('Range must be ascending')
    expect(() => next('5-3 * * * *')).toThrow('Range must be ascending')
    expect(() => next('0 0 * * SAT-SUN')).toThrow('Range must be ascending')
  })

  test('reads a value with a step as "from there, every step"', () => {
    expect(next('5/15 * * * *')).toBe('2026-10-30T12:35:00.000Z')
    expect(next('1/5 * * * *')).toBe('2026-10-30T12:36:00.000Z')
    expect(next('0 3/12 * * *')).toBe('2026-10-30T15:00:00.000Z')
  })

  test('still reads what it always did', () => {
    expect(next('*/15 * * * *')).toBe('2026-10-30T12:45:00.000Z')
    expect(next('0 9 * * MON-FRI')).toBe('2026-11-02T09:00:00.000Z')
    expect(next('0 0 1-31/10 * *')).toBe('2026-10-31T00:00:00.000Z')
    expect(next('0 0 * jan-mar *')).toBe('2027-01-01T00:00:00.000Z')
    expect(next('0 0 * * 5-7')).toBe('2026-10-31T00:00:00.000Z')
    expect(next('@daily')).toBe('2026-10-31T00:00:00.000Z')
  })
})
