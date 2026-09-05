import { describe, expect, it } from 'bun:test'
import { median, rateAttainmentPercent, renderMemoryReport } from './report'

describe('memory benchmark report', () => {
  it('calculates medians for odd and even sample counts', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([8, 2, 6, 4])).toBe(5)
  })

  it('calculates fixed-rate attainment', () => {
    expect(rateAttainmentPercent(39_200, 40_000)).toBe(98)
  })

  it('reports settled RSS and run spread in MiB', () => {
    const report = renderMemoryReport({
      meta: {
        startedAt: '2026-09-04T00:00:00.000Z',
        source: { revision: 'a'.repeat(40), dirty: true },
        driver: 'oha',
        publishable: true,
        scenario: 'static-json',
        connections: 64,
        loadSeconds: 60,
        idleSeconds: 180,
        sampleIntervalMs: 100,
        settleSeconds: 10,
        runs: 2,
        machine: {
          platform: 'linux',
          release: '6.0',
          cpu: 'Test CPU',
          cores: 8,
          bun: '1.4.1',
        },
      },
      targets: [{ id: 'stacks', label: 'Stacks', requestRate: 40_000 }],
      measurements: [
        { targetId: 'stacks', run: 1, requestRate: 40_000, settledRssBytes: 100 * 1024 * 1024, peakLoadRssBytes: 150 * 1024 * 1024, rpsMean: 39_900, requests: 2_394_000, errors: 0 },
        { targetId: 'stacks', run: 2, requestRate: 40_000, settledRssBytes: 120 * 1024 * 1024, peakLoadRssBytes: 170 * 1024 * 1024, rpsMean: 40_000, requests: 2_400_000, errors: 1 },
      ],
    })

    expect(report).toContain(`| Source at start | \`${'a'.repeat(40)}\` (modified working tree) |`)
    expect(report).toContain('| Runtime | Bun 1.4.1 |')
    expect(report).toContain('| Stacks | 40,000 | 39,950 | 99.9% | 110.0 | 100.0-120.0 | 160.0 | 1 |')
  })
})
