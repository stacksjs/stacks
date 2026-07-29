import { describe, expect, it } from 'bun:test'
import { createdWithinDays, dateValue, daysAgoIso, numberValue, textValue } from './data-records'

describe('dashboard data record shaping', () => {
  it('normalizes response values without leaking arbitrary objects', () => {
    expect(textValue(null, 'fallback')).toBe('fallback')
    expect(textValue('  active  ')).toBe('active')
    expect(numberValue('12')).toBe(12)
    expect(numberValue('invalid')).toBe(0)
    expect(dateValue('invalid')).toBe('')
  })

  it('computes recent records from their real timestamps', () => {
    const now = Date.parse('2026-07-29T12:00:00.000Z')
    expect(createdWithinDays('2026-07-28T12:00:00.000Z', 7, now)).toBe(true)
    expect(createdWithinDays('2026-07-01T12:00:00.000Z', 7, now)).toBe(false)
    expect(daysAgoIso(7, now)).toBe('2026-07-22T12:00:00.000Z')
  })
})
