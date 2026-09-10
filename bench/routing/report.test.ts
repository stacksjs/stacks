import type { Measurement, RunMeta } from './report'
import { describe, expect, test } from 'bun:test'
import { renderReport } from './report'
import { SCENARIOS } from './scenarios'

const meta: RunMeta = {
  startedAt: '2026-09-07T00:00:00Z',
  source: { revision: 'a'.repeat(40), dirty: false },
  sourceAtEnd: { revision: 'a'.repeat(40), dirty: false },
  stacksSourceModules: {
    '@stacksjs/actions': 'storage/framework/core/actions/src/index.ts',
    '@stacksjs/database': 'storage/framework/core/database/src/index.ts',
    '@stacksjs/database/replicas': 'storage/framework/core/database/src/replicas.ts',
    '@stacksjs/query-builder': 'storage/framework/core/query-builder/src/index.ts',
    '@stacksjs/router': 'storage/framework/core/router/src/index.ts',
    '@stacksjs/validation': 'storage/framework/core/validation/src/index.ts',
  },
  stacksRuntimeDependencies: {
    '@stacksjs/bun-router': { version: '0.1.11', path: 'node_modules/@stacksjs/bun-router/dist/index.js' },
  },
  driver: 'oha',
  driverVersion: 'oha 1.16.0',
  loadTopology: 'same-host',
  peerVersions: { elysia: '1.4.30', hono: '4.13.5' },
  publishable: true,
  connections: 16,
  warmupSeconds: 1,
  durationSeconds: 3,
  runs: 3,
  persistentQueryLogging: false,
  machine: { arch: 'arm64', platform: 'darwin', release: 'test', cpu: 'test', cores: 1, bun: '1.4.1' },
}

const measurement: Measurement = {
  targetId: 'stacks-minimal',
  scenarioId: 'static-json',
  rpsMean: 85,
  rpsP50: 84,
  latencyMs: { p50: 1, p90: 2, p99: 3 },
  errorRate: 0,
  cpuPercent: 99,
  cpuMicrosPerRequest: null,
  rateAttained: null,
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
    expect(report).toContain('| Architecture | arm64 |')
    expect(report).toContain('| Load generator version | oha 1.16.0 |')
    expect(report).toContain('| Load topology | same host as target server |')
    expect(report).toContain('| Peer framework versions | `elysia`: 1.4.30<br>`hono`: 4.13.5 |')
    expect(report).toContain('`@stacksjs/router`: `storage/framework/core/router/src/index.ts`')
    expect(report).toContain('| Stacks runtime dependencies | `@stacksjs/bun-router`: 0.1.11 at `node_modules/@stacksjs/bun-router/dist/index.js` |')
    expect(report).toContain(`| Source at end | \`${'a'.repeat(40)}\` (clean working tree) |`)
    expect(report).toContain('> **Unstable result.** **Stacks minimal** (11.8% range) exceeded the 10% throughput range limit.')
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

  test('reports per-request CPU cost for a fixed-rate run and drops the throughput ratio', () => {
    const report = renderReport({
      meta: { ...meta, requestRate: 20_000 },
      scenarios: [SCENARIOS[0]!],
      targets: [{ id: 'stacks-minimal', label: 'Stacks minimal' }],
      measurements: [{
        ...measurement,
        rpsMean: 19_990,
        rpsP50: 19_995,
        spread: { min: 19_985, max: 19_995 },
        cpuMicrosPerRequest: 17.75,
        cpuCostSpread: { min: 17.5, max: 18 },
        rateAttained: 0.9995,
        relativeToRaw: { median: 1, spread: { min: 1, max: 1 } },
      }],
    })

    expect(report).toContain('| Request rate | fixed at 20,000 req/s for every target (cost profile) |')
    expect(report).toContain('| Target | CPU us/req | cost spread | rate | req/s |')
    expect(report).toContain('| Stacks minimal | 17.75 | 17.50-18.00 (2.8%) | 100.0% |')
    // A ratio of throughputs is 100% for every row once the rate is pinned.
    expect(report).not.toContain('Bun raw')
  })

  test('marks a fixed-rate row that could not keep up as invalid rather than cheap', () => {
    const report = renderReport({
      meta: { ...meta, requestRate: 20_000 },
      scenarios: [SCENARIOS[0]!],
      targets: [{ id: 'stacks-minimal', label: 'Stacks minimal' }],
      measurements: [{
        ...measurement,
        cpuMicrosPerRequest: 9,
        cpuCostSpread: { min: 8.9, max: 9.1 },
        rateAttained: 0.62,
      }],
    })

    expect(report).toContain('| Stacks minimal | 9.00 (invalid) | 8.90-9.10 (2.2%) | 62.0% (invalid) |')
  })

  test('marks a busy-host override as direction-only', () => {
    const report = renderReport({
      meta: {
        ...meta,
        publishable: false,
        busyHostProcesses: [{ pid: 42, cpuPercent: 91.25, command: 'compiler' }],
      },
      scenarios: [],
      targets: [],
      measurements: [],
    })

    expect(report).toContain('> **Busy-host override.** compiler (PID 42, 91.3% CPU). This run is direction-only and must not be published.')
    expect(report).toContain('| Load generator | `oha` (direction-only) |')
    expect(report).not.toContain('built-in Bun load generator')
  })

  test('explains why the built-in generator is direction-only', () => {
    const report = renderReport({
      meta: { ...meta, driver: 'builtin', publishable: false },
      scenarios: [],
      targets: [],
      measurements: [],
    })

    expect(report).toContain('built-in Bun load generator')
    expect(report).toContain('| Load generator | `builtin` (direction-only) |')
  })

  test('lists publication blockers', () => {
    const report = renderReport({
      meta: {
        ...meta,
        publishable: false,
        publicationIssues: ['BENCH_DEDICATED=1 is not set', 'measurement window is 3s; at least 30s is required'],
      },
      scenarios: [],
      targets: [],
      measurements: [],
    })

    expect(report).toContain('**Publication blockers.** BENCH_DEDICATED=1 is not set; measurement window is 3s; at least 30s is required.')
  })
})
