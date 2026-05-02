/**
 * Scheduler invalid-pattern guard tests.
 *
 * The Schedule class validates timing inputs at definition time so a
 * typo'd `.at('14:70')` or `.onDays([32])` throws immediately instead
 * of silently producing a pattern that never fires. These tests pin
 * that contract so a refactor doesn't quietly relax it.
 */

import { describe, expect, it } from 'bun:test'

describe('scheduler invalid pattern guards', () => {
  it('throws on .at() with malformed time', async () => {
    const { Schedule } = await import('../src/schedule')
    expect(() => new Schedule(() => {}).at('14')).toThrow(/Expected "HH:MM"/)
    expect(() => new Schedule(() => {}).at('14:30:45')).toThrow(/Expected "HH:MM"/)
    expect(() => new Schedule(() => {}).at(':')).toThrow()
  })

  it('throws on .at() with out-of-range hours', async () => {
    const { Schedule } = await import('../src/schedule')
    expect(() => new Schedule(() => {}).at('24:00')).toThrow(/Hour must be 0-23/)
    expect(() => new Schedule(() => {}).at('-1:00')).toThrow()
    expect(() => new Schedule(() => {}).at('99:30')).toThrow()
  })

  it('throws on .at() with out-of-range minutes', async () => {
    const { Schedule } = await import('../src/schedule')
    expect(() => new Schedule(() => {}).at('14:60')).toThrow(/minute must be 0-59/)
    expect(() => new Schedule(() => {}).at('14:70')).toThrow(/minute must be 0-59/)
    expect(() => new Schedule(() => {}).at('14:99')).toThrow()
  })

  it('accepts valid .at() inputs', async () => {
    const { Schedule } = await import('../src/schedule')
    expect(() => new Schedule(() => {}).at('00:00')).not.toThrow()
    expect(() => new Schedule(() => {}).at('14:30')).not.toThrow()
    expect(() => new Schedule(() => {}).at('23:59')).not.toThrow()
    expect(() => new Schedule(() => {}).at('9:05')).not.toThrow()
  })

  it('throws on .onDays() with empty array', async () => {
    const { Schedule } = await import('../src/schedule')
    expect(() => new Schedule(() => {}).onDays([])).toThrow(/non-empty/)
  })

  it('throws on .onDays() with out-of-range days', async () => {
    const { Schedule } = await import('../src/schedule')
    expect(() => new Schedule(() => {}).onDays([7])).toThrow(/0-6/)
    expect(() => new Schedule(() => {}).onDays([32])).toThrow(/0-6/)
    expect(() => new Schedule(() => {}).onDays([-1])).toThrow(/0-6/)
  })

  it('throws on .onDays() with non-integer days', async () => {
    const { Schedule } = await import('../src/schedule')
    expect(() => new Schedule(() => {}).onDays([1.5])).toThrow(/integer/)
    expect(() => new Schedule(() => {}).onDays([Number.NaN])).toThrow(/integer/)
  })

  it('accepts valid .onDays() inputs', async () => {
    const { Schedule } = await import('../src/schedule')
    expect(() => new Schedule(() => {}).onDays([0, 1, 2, 3, 4, 5, 6])).not.toThrow()
    expect(() => new Schedule(() => {}).onDays([1])).not.toThrow()
  })
})
