import process from 'node:process'
import { afterEach, describe, expect, it } from 'bun:test'
import { currentLevel, suppressedAtCurrentLevel } from '../src/index'

/**
 * `info` and `success` honour the level in force at EMIT time
 * (stacksjs/stacks#853).
 *
 * The underlying logger is constructed with a snapshot of `LOG_LEVEL`, so a
 * value set after this module loaded had no effect on `info` - which
 * contradicts `currentLevel()`'s documented contract that the env is re-read
 * per call, and which made `buddy --quiet` print everything it promised to
 * suppress. `debug` already decided at emit time; `info` and `success` now
 * match it.
 *
 * The DECISION is tested rather than the console: the logger writes through
 * its own transport, so capturing stdout tests the transport rather than the
 * rule.
 */

const original = process.env.LOG_LEVEL

afterEach(() => {
  if (original === undefined)
    delete process.env.LOG_LEVEL
  else
    process.env.LOG_LEVEL = original
})

describe('suppressedAtCurrentLevel', () => {
  it('suppresses nothing at the default level except debug', () => {
    delete process.env.LOG_LEVEL
    expect(currentLevel()).toBe('info')
    expect(suppressedAtCurrentLevel('debug')).toBeTrue()
    expect(suppressedAtCurrentLevel('info')).toBeFalse()
    expect(suppressedAtCurrentLevel('success')).toBeFalse()
    expect(suppressedAtCurrentLevel('warning')).toBeFalse()
    expect(suppressedAtCurrentLevel('error')).toBeFalse()
  })

  it('suppresses info AND success at warning, which is what --quiet sets', () => {
    // A "quiet" run that still narrated every step it completed would not be
    // quiet, so `success` has to go with `info`.
    process.env.LOG_LEVEL = 'warning'
    expect(suppressedAtCurrentLevel('info')).toBeTrue()
    expect(suppressedAtCurrentLevel('success')).toBeTrue()
  })

  it('never suppresses warnings or errors, which are not "non-essential output"', () => {
    for (const level of ['warning', 'error'] as const) {
      process.env.LOG_LEVEL = level
      expect(suppressedAtCurrentLevel('error')).toBeFalse()
    }
    process.env.LOG_LEVEL = 'warning'
    expect(suppressedAtCurrentLevel('warning')).toBeFalse()
  })

  it('reads the level per call, not once', () => {
    // This is the bug in one assertion: the value changes after the module
    // (and the logger) already existed.
    process.env.LOG_LEVEL = 'warning'
    expect(suppressedAtCurrentLevel('info')).toBeTrue()

    process.env.LOG_LEVEL = 'info'
    expect(suppressedAtCurrentLevel('info')).toBeFalse()

    process.env.LOG_LEVEL = 'debug'
    expect(suppressedAtCurrentLevel('debug')).toBeFalse()
  })

  it('ignores an invalid level rather than suppressing everything', () => {
    // `parseLogLevel` falls back to `info`; a typo must not silence the app.
    process.env.LOG_LEVEL = 'quiett'
    expect(suppressedAtCurrentLevel('info')).toBeFalse()
    expect(suppressedAtCurrentLevel('error')).toBeFalse()
  })
})
