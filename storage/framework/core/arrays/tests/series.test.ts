import { expect, test } from 'bun:test'
import { finiteNumeric, mergeDailySeries, summarizeSeries } from '../src/series'

test('one observation per day and field, with source fallbacks and zero preserved', () => {
  const result = mergeDailySeries([
    { day: '2026-01-02', source: 'copy', values: { steps: 800, hrv: 60, sleep: 8 } },
    { day: '2026-01-02', source: 'device', values: { steps: 0, hrv: null } },
    { day: '2026-01-01', source: 'device', values: { hrv: '40', bad: '' } },
    { day: '2026-02-30', source: 'device', values: { hrv: 70 } },
  ], ['device', 'copy'])
  expect(result).toEqual([
    { date: '2026-01-01', values: { hrv: 40 }, sources: { hrv: 'device' } },
    { date: '2026-01-02', values: { steps: 0, hrv: 60, sleep: 8 }, sources: { steps: 'device', hrv: 'copy', sleep: 'copy' } },
  ])
})
test('latest update wins same-source ties; input is not mutated', () => {
  const rows = [
    { day: '2026-01-01', source: 'scale', values: { weight: 80 }, updatedAt: '2026-01-01' },
    { day: '2026-01-01', source: 'scale', values: { weight: 81 }, updatedAt: '2026-01-02' },
  ]
  expect(mergeDailySeries(rows)[0]?.values.weight).toBe(81)
  expect(rows[0]?.values.weight).toBe(80)
})
test('statistics sort dates, preserve decimal averages and ignore nonfinite values', () => {
  expect(summarizeSeries([{ date: '2026-02-02', value: 7.5 }, { date: '2026-01-01', value: 0 }, { date: '2026-03-03', value: NaN }]))
    .toEqual({ count: 2, latest: { date: '2026-02-02', value: 7.5 }, average: 3.75, lowest: 0, highest: 7.5 })
  expect(summarizeSeries([]).average).toBeNull()
  for (const value of [null, undefined, false, '', ' ', Infinity, 'abc']) expect(finiteNumeric(value)).toBeNull()
})
