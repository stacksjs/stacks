import { describe, expect, test } from 'bun:test'
import type { StartupSample } from './statistics'
import { summarizeStartupMetric, validateStartupSamples } from './statistics'

function samples(pairs = 15): StartupSample[] {
  return Array.from({ length: pairs }, (_, pair) => [
    { importMs: 10 + pair, order: pair % 2, pair, rssBytes: 1000 + pair, variant: 'root' as const },
    { importMs: 5 + pair / 2, order: 1 - (pair % 2), pair, rssBytes: 800 + pair, variant: 'runtime' as const },
  ]).flat()
}

describe('startup benchmark statistics', () => {
  test('retains paired ratios and sign counts', () => {
    const summary = summarizeStartupMetric(samples(), 15, 'importMs')
    expect(summary.rootMedian).toBe(17)
    expect(summary.runtimeMedian).toBe(8.5)
    expect(summary.pairedMedianRatio).toBe(0.5)
    expect(summary.runtimeLowerPairs).toBe(15)
    expect(summary.runtimeEqualPairs).toBe(0)
    expect(summary.runtimeHigherPairs).toBe(0)
    expect(summary.pairedRatios).toHaveLength(15)
  })

  test('rejects incomplete, duplicate, and malformed samples', () => {
    const valid = samples()
    expect(() => validateStartupSamples(valid.slice(1), 15)).toThrow('Expected 30')

    const duplicate = structuredClone(valid)
    duplicate[1]!.variant = 'root'
    expect(() => validateStartupSamples(duplicate, 15)).toThrow('one root and one runtime')

    const malformed = structuredClone(valid)
    malformed[0]!.rssBytes = 0
    expect(() => validateStartupSamples(malformed, 15)).toThrow('invalid RSS')
  })
})
