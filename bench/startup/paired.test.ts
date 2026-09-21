import { describe, expect, test } from 'bun:test'
import { summarizePairedMetric, validatePairedSamples } from './paired'

const rows = Array.from({ length: 3 }, (_, pair) => [
  { order: pair % 2, pair, value: 10 + pair, variant: 'root' as const },
  { order: 1 - (pair % 2), pair, value: 5 + pair / 2, variant: 'runtime' as const },
]).flat()

describe('paired startup measurements', () => {
  test('summarizes any positive paired metric', () => {
    const summary = summarizePairedMetric(rows, 3, 'ready time', row => row.value)
    expect(summary.rootMedian).toBe(11)
    expect(summary.runtimeMedian).toBe(5.5)
    expect(summary.pairedMedianRatio).toBe(0.5)
    expect(summary.runtimeLowerPairs).toBe(3)
  })

  test('rejects malformed structure and values', () => {
    expect(() => validatePairedSamples(rows.slice(1), 3)).toThrow('Expected 6')
    expect(() => summarizePairedMetric([{ ...rows[0]!, value: 0 }, ...rows.slice(1)], 3, 'ready time', row => row.value)).toThrow('invalid ready time')
  })
})
