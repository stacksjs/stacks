import { expect, test } from 'bun:test'
import { localTimeSpan, timeSpansOverlap } from '../src/schedule'

test('conflicts use instants across location clocks and calendar dates', () => {
  const la = localTimeSpan('2026-11-02', '09:00', '10:00', 'America/Los_Angeles')
  expect(timeSpansOverlap(la, localTimeSpan('2026-11-02', '12:00', '13:00', 'America/New_York'))).toBe(true)
  expect(timeSpansOverlap(la, localTimeSpan('2026-11-02', '09:00', '10:00', 'America/New_York'))).toBe(false)
  expect(timeSpansOverlap(la, localTimeSpan('2026-11-02', '10:00', '11:00', 'America/Los_Angeles'))).toBe(false)
  expect(timeSpansOverlap(localTimeSpan('2026-11-02', '00:00', '01:00', 'Pacific/Kiritimati'), localTimeSpan('2026-11-01', '00:00', '01:00', 'Pacific/Honolulu'))).toBe(true)
  expect(() => timeSpansOverlap(la, { start: new Date(Number.NaN), end: new Date() })).toThrow(/positive/)
})
