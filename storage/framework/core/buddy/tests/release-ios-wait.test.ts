import { describe, expect, it } from 'bun:test'
import { waitMinutes } from '../src/commands/release'

describe('buddy release:ios --wait', () => {
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
