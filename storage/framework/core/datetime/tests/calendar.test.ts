import { expect, test } from 'bun:test'
import { addCalendarMonths } from '../src/calendar'

test('month and year boundaries clamp without skipping February or mutating input', () => {
  const january = new Date('2024-01-31T12:34:56Z')
  expect(addCalendarMonths(january, 1, { utc: true }).toISOString()).toBe('2024-02-29T12:34:56.000Z')
  expect(january.toISOString()).toBe('2024-01-31T12:34:56.000Z')
  expect(addCalendarMonths(new Date('2024-02-29T00:00:00Z'), 12, { utc: true }).toISOString()).toBe('2025-02-28T00:00:00.000Z')
  expect(addCalendarMonths(new Date('2024-03-31T00:00:00Z'), -1, { utc: true }).toISOString()).toBe('2024-02-29T00:00:00.000Z')
  expect(() => addCalendarMonths(january, 1.5)).toThrow()
})
