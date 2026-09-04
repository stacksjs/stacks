import { describe, expect, it } from 'bun:test'
import { median, renderMemoryReport } from './report'

describe('memory benchmark report', () => {
  it('calculates medians for odd and even sample counts', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([8, 2, 6, 4])).toBe(5)
  })

  it('reports settled RSS and run spread in MiB', () => {
    const report = renderMemoryReport({
      meta: {
        startedAt: '2026-09-04T00:00:00.000Z',
        driver: 'oha',
        publishable: true,
        scenario: 'static-json',
        connections: 50,
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
      targets: [{ id: 'stacks', label: 'Stacks' }],
      measurements: [
        { targetId: 'stacks', run: 1, settledRssBytes: 100 * 1024 * 1024, peakLoadRssBytes: 150 * 1024 * 1024, rpsMean: 1_000, requests: 60_000, errors: 0 },
        { targetId: 'stacks', run: 2, settledRssBytes: 120 * 1024 * 1024, peakLoadRssBytes: 170 * 1024 * 1024, rpsMean: 1_200, requests: 72_000, errors: 1 },
      ],
    })

    expect(report).toContain('| Runtime | Bun 1.4.1 |')
    expect(report).toContain('| Stacks | 110.0 | 100.0-120.0 | 160.0 | 1,100 | 1 |')
  })
})
