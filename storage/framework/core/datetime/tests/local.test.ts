import { expect, test } from 'bun:test'
import { localDateTime } from '../src/local'

test('site and organization clocks use the same instant across different calendar days', () => {
  const instant = new Date('2026-10-10T16:00:00Z')
  expect(localDateTime(instant, 'America/Los_Angeles', 'Pacific/Kiritimati')).toEqual({ date: '2026-10-10', time: '09:00', timeZone: 'America/Los_Angeles' })
  expect(localDateTime(instant, 'bad-zone', 'Pacific/Kiritimati')).toEqual({ date: '2026-10-11', time: '06:00', timeZone: 'Pacific/Kiritimati' })
  expect(localDateTime(instant, null, 'bad-zone').timeZone).toBe('UTC')
  expect(() => localDateTime(new Date('invalid'), 'UTC')).toThrow(RangeError)
})
