import { describe, expect, test } from 'bun:test'
import type { PeerStartupSample } from './peer-statistics'
import { percentile, summarizePeerStartupMetric, validatePeerStartupSamples } from './peer-statistics'

const response = { status: 200, mediaType: 'application/json', bodySha256: 'a'.repeat(64) }

function samples(runs = 15): PeerStartupSample[] {
  return Array.from({ length: runs }, (_, run) => [
    { run, order: run % 2, targetId: 'stacks', listenMs: 20, firstResponseMs: 22, rssBytes: 200, response },
    { run, order: 1 - (run % 2), targetId: 'bun-raw', listenMs: 10, firstResponseMs: 11, rssBytes: 100, response },
  ]).flat()
}

describe('peer startup statistics', () => {
  test('calculates interpolated percentiles without mutating samples', () => {
    const values = [40, 10, 30, 20]
    expect(percentile(values, 0)).toBe(10)
    expect(percentile(values, 0.25)).toBe(17.5)
    expect(percentile(values, 0.5)).toBe(25)
    expect(percentile(values, 0.75)).toBe(32.5)
    expect(percentile(values, 1)).toBe(40)
    expect(values).toEqual([40, 10, 30, 20])
    expect(() => percentile([], 0.5)).toThrow('without values')
    expect(() => percentile(values, 2)).toThrow('between 0 and 1')
  })

  test('summarizes run-paired ratios to Bun native', () => {
    const summaries = summarizePeerStartupMetric(samples(), 15, ['stacks', 'bun-raw'], 'listenMs')
    expect(summaries[0]).toMatchObject({
      targetId: 'stacks',
      median: 20,
      baselineMedian: 10,
      medianPercentChange: 100,
      pairedMedianRatio: 2,
      targetLowerRuns: 0,
      targetEqualRuns: 0,
      targetHigherRuns: 15,
    })
    expect(summaries[1]).toMatchObject({ pairedMedianRatio: 1, targetEqualRuns: 15 })
  })

  test('rejects incomplete cycles, malformed measurements, and response drift', () => {
    const valid = samples()
    expect(() => validatePeerStartupSamples(valid.slice(1), 15, ['stacks', 'bun-raw'])).toThrow('Expected 30')
    const malformed = structuredClone(valid)
    malformed[0]!.firstResponseMs = 1
    expect(() => validatePeerStartupSamples(malformed, 15, ['stacks', 'bun-raw'])).toThrow('invalid response time')
    const drift = structuredClone(valid)
    drift[0]!.response = { ...drift[0]!.response, bodySha256: 'b'.repeat(64) }
    expect(() => validatePeerStartupSamples(drift, 15, ['stacks', 'bun-raw'])).toThrow('responses are inconsistent')

    const unbalanced = structuredClone(valid)
    for (const sample of unbalanced)
      sample.order = sample.targetId === 'stacks' ? 0 : 1
    expect(() => validatePeerStartupSamples(unbalanced, 15, ['stacks', 'bun-raw'])).toThrow('unbalanced process positions')
  })
})
