import { describe, expect, it } from 'bun:test'
import { retainedBuildCount, waitMinutes } from '../src/commands/release'

describe('buddy release:ios --wait', () => {
  it('requires an explicit nonnegative retention count instead of coercing invalid input to expire-all', () => {
    expect(retainedBuildCount(undefined)).toBe(1)
    expect(retainedBuildCount('2')).toBe(2)
    expect(retainedBuildCount(0)).toBe(0)
    for (const invalid of [-1, 1.5, NaN, Infinity, 'many', '', ' ', '1.5'])
      expect(() => retainedBuildCount(invalid)).toThrow('nonnegative integer')
  })
  it('does not wait unless asked, waits an hour by default, and takes minutes', () => {
    expect(waitMinutes(undefined)).toBeNull()
    expect(waitMinutes(false)).toBeNull()
    expect(waitMinutes(true)).toBe(60)
    expect(waitMinutes('')).toBe(60)
    expect(waitMinutes('90')).toBe(90)
    expect(waitMinutes(0)).toBe(0)
    expect(() => waitMinutes('soon')).toThrow('minutes')
    expect(() => waitMinutes(-5)).toThrow('minutes')
  })
})
