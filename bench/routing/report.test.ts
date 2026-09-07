import type { Measurement, RunMeta } from './report'
import { describe, expect, test } from 'bun:test'
import { renderReport } from './report'
import { SCENARIOS } from './scenarios'

const meta: RunMeta = {
  startedAt: '2026-09-07T00:00:00Z',
  driver: 'oha',
  publishable: true,
  connections: 16,
  warmupSeconds: 1,
  durationSeconds: 3,
  runs: 3,
  persistentQueryLogging: false,
  machine: { platform: 'darwin', release: 'test', cpu: 'test', cores: 1, bun: '1.4.1' },
}

const measurement: Measurement = {
  targetId: 'stacks-minimal',
  scenarioId: 'static-json',
  rpsMean: 85,
  rpsP50: 84,
  latencyMs: { p50: 1, p90: 2, p99: 3 },
  errorRate: 0,
  cpuPercent: 99,
  spread: { min: 80, max: 90 },
  runs: 3,
}

describe('routing benchmark report', () => {
  test('renders the paired Bun raw ratio and spread when available', () => {
    const report = renderReport({
      meta,
      scenarios: [SCENARIOS[0]!],
      targets: [{ id: 'stacks-minimal', label: 'Stacks minimal' }],
      measurements: [{
        ...measurement,
        relativeToRaw: { median: 0.85, spread: { min: 0.8, max: 0.9 } },
      }],
    })

    expect(report).toContain('| Target | req/s | req/s p50 | spread | Bun raw |')
    expect(report).toContain('> **Unstable result.** **Stacks minimal** (11.8% range) exceeded the 10% range limit.')
    expect(report).toContain('| Stacks minimal | 85 | 84 | 80-90 (11.8%) | 85.0% (80.0%-90.0%) |')
  })

  test('omits the comparison column when Bun raw was not measured', () => {
    const report = renderReport({
      meta,
      scenarios: [SCENARIOS[0]!],
      targets: [{ id: 'stacks-minimal', label: 'Stacks minimal' }],
      measurements: [measurement],
    })

    expect(report).not.toContain('Bun raw')
  })
})
