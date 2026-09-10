/**
 * Clock control (stacksjs/stacks#2581).
 *
 * `afterEach(useRealTime)` is not decoration: the system time is process-wide
 * and bun does not roll it back between files, so a test that froze the clock
 * and did not restore it would break every later suite in the run - including
 * the ones in this very file.
 */

import { afterEach, describe, expect, it } from 'bun:test'
import { freezeTime, travelTo, useRealTime } from '../src/time'

afterEach(useRealTime)

describe('freezeTime', () => {
  it('stops the clock at the given moment', () => {
    freezeTime('2024-01-15T10:00:00Z')
    expect(new Date().toISOString()).toBe('2024-01-15T10:00:00.000Z')
  })

  it('holds it there across reads', () => {
    // The point of freezing: two reads either side of some work agree.
    freezeTime('2024-01-15T10:00:00Z')
    const first = Date.now()
    for (let i = 0; i < 1e5; i++) { /* burn a little wall clock */ }
    expect(Date.now()).toBe(first)
  })

  it('accepts a Date, an ISO string and an epoch number', () => {
    for (const at of [new Date('2024-06-01T00:00:00Z'), '2024-06-01T00:00:00Z', Date.parse('2024-06-01T00:00:00Z')]) {
      freezeTime(at)
      expect(new Date().toISOString()).toBe('2024-06-01T00:00:00.000Z')
    }
  })

  it('freezes at now when given nothing', () => {
    const before = Date.now()
    const frozen = freezeTime()
    expect(frozen.getTime()).toBeGreaterThanOrEqual(before)
    expect(Date.now()).toBe(frozen.getTime())
  })

  it('returns the moment it froze at, so a test can assert against it', () => {
    const at = freezeTime('2024-01-15T10:00:00Z')
    expect(at.toISOString()).toBe('2024-01-15T10:00:00.000Z')
  })

  it('rejects a time it cannot parse rather than freezing at Invalid Date', () => {
    // `new Date('nonsense')` is a Date whose getTime() is NaN. Passing that to
    // setSystemTime would leave the clock somewhere unpredictable, which is a
    // far worse failure than an argument error.
    expect(() => freezeTime('nonsense')).toThrow(TypeError)
    expect(() => freezeTime(Number.NaN)).toThrow(TypeError)
  })
})

describe('travelTo', () => {
  it('moves the clock and leaves it frozen', () => {
    travelTo(new Date('2024-06-01T00:00:00Z'))
    expect(new Date().getMonth()).toBe(5) // June
    const first = Date.now()
    expect(Date.now()).toBe(first)
  })

  it('can be called again to move on', () => {
    freezeTime('2024-01-15T10:00:00Z')
    travelTo('2024-06-01T00:00:00Z')
    expect(new Date().toISOString()).toBe('2024-06-01T00:00:00.000Z')
  })
})

describe('useRealTime', () => {
  it('hands the clock back', () => {
    freezeTime('2024-01-15T10:00:00Z')
    expect(new Date().getFullYear()).toBe(2024)

    useRealTime()
    expect(new Date().getFullYear()).toBeGreaterThan(2024)
  })

  it('is safe to call when the clock was never frozen', () => {
    // `afterEach(useRealTime)` runs after every test, including the ones that
    // never touched the clock.
    expect(() => useRealTime()).not.toThrow()
  })
})
