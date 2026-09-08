import { describe, expect, it } from 'bun:test'
import { routingMeasurementPublicationIssues, routingPublicationIssues } from './publication'
import { SCENARIOS } from './scenarios'
import { DEFAULT_TARGETS } from './targets'

const publishable = {
  driverPublishable: true,
  driverVersion: 'oha 1.16.0',
  dedicated: true,
  runtimeRequirement: { range: '1.4.1', matches: true },
  source: { revision: 'a'.repeat(40), dirty: false },
  targetIds: DEFAULT_TARGETS.map(target => target.id),
  scenarioIds: SCENARIOS.map(scenario => scenario.id),
  peerVersions: { elysia: '1.4.30', express: '5.2.1', fastify: '5.12.3', hono: '4.13.7' },
  stacksRuntimeDependencies: {
    '@stacksjs/bun-router': { version: '0.1.11', path: 'node_modules/@stacksjs/bun-router/dist/index.js' },
  },
  warmupSeconds: 5,
  durationSeconds: 30,
  runs: 3,
  busyHostProcesses: [],
}

const responseEvidence = {
  status: 200,
  mediaType: 'application/json',
  bodyBytes: 17,
  bodySha256: 'a'.repeat(64),
}

function parityChecks(targetId: string, scenarioId: string, runs = 3) {
  const evidence = { primary: responseEvidence, probes: [] }
  return Array.from({ length: runs }, (_, index) => ({
    targetId,
    scenarioId,
    run: index + 1,
    before: evidence,
    after: evidence,
  }))
}

describe('routing benchmark publication profile', () => {
  it('accepts an isolated run with the full measurement windows', () => {
    expect(routingPublicationIssues(publishable)).toEqual([])
  })

  it('explains every unmet prerequisite', () => {
    expect(routingPublicationIssues({
      ...publishable,
      driverPublishable: false,
      driverVersion: null,
      dedicated: false,
      runtimeRequirement: { range: '1.4.1', matches: false },
      source: { revision: null, dirty: null },
      peerVersions: { elysia: 'unavailable' },
      stacksRuntimeDependencies: {
        '@stacksjs/bun-router': { version: 'unavailable', path: 'unavailable' },
      },
      warmupSeconds: 1,
      durationSeconds: 10,
      runs: 1,
      busyHostProcesses: [{ pid: 42, cpuPercent: 90, command: 'compiler' }],
    })).toEqual([
      'load generator is not publishable',
      'load generator version is unavailable',
      'BENCH_DEDICATED=1 is not set',
      'runtime does not match package.json engines.bun',
      'source revision is unavailable or the working tree is not clean',
      'peer framework version is unavailable for elysia, express, fastify, hono',
      'Stacks runtime dependency is unavailable for @stacksjs/bun-router',
      'warm-up is 1s; at least 5s is required',
      'measurement window is 10s; at least 30s is required',
      'only 1 run(s) were requested; at least 3 are required',
      'competing host processes were observed',
    ])
  })

  it('rejects cherry-picked or duplicate comparison matrices', () => {
    expect(routingPublicationIssues({
      ...publishable,
      targetIds: ['stacks-minimal', 'bun-raw'],
      scenarioIds: ['static-json'],
    })).toContain('scenario set does not match the full routing matrix')
    expect(routingPublicationIssues({
      ...publishable,
      targetIds: [...publishable.targetIds, 'stacks'],
    })).toContain('target set contains duplicate targets')
    expect(routingPublicationIssues({
      ...publishable,
      targetIds: publishable.targetIds.filter(id => id !== 'stacks'),
    })).toContain('target set omits default targets: stacks')
  })

  it('accepts complete, stable, error-free measurements with CPU evidence', () => {
    expect(routingMeasurementPublicationIssues(
      [{ id: 'stacks' }],
      [{ id: 'static-json' }],
      [{
        targetId: 'stacks', scenarioId: 'static-json', rpsMean: 100, rpsP50: 99,
        latencyMs: { p50: 1, p90: 2, p99: 3 }, errorRate: 0, cpuPercent: 98,
        spread: { min: 98, max: 102 }, rangeRatio: 0.04, runs: 3,
      }],
      3,
      parityChecks('stacks', 'static-json'),
    )).toEqual([])
  })

  it('rejects skipped, incomplete, invalid, failed, unprofiled, and unstable measurements', () => {
    expect(routingMeasurementPublicationIssues(
      [{ id: 'missing', skipped: 'dependency unavailable' }, { id: 'stacks' }],
      [{ id: 'static-json' }, { id: 'path-param' }],
      [{
        targetId: 'stacks', scenarioId: 'static-json', rpsMean: 100, rpsP50: -1,
        latencyMs: { p50: 1, p90: 2, p99: 3 }, errorRate: 0.01, cpuPercent: null,
        spread: { min: 90, max: 110 }, rangeRatio: 0.2, runs: 3,
      }],
      3,
      [
        ...parityChecks('stacks', 'static-json'),
        ...parityChecks('stacks', 'path-param'),
      ],
    )).toEqual([
      'missing was skipped',
      'stacks:static-json contains an invalid measurement',
      'stacks:static-json recorded request errors',
      'stacks:static-json has no valid server CPU reading',
      'stacks:static-json exceeded the 10% throughput stability range',
      'stacks:path-param did not complete 3 required run(s)',
    ])
  })

  it('rejects missing, malformed, duplicated, and changing parity evidence', () => {
    const measurement = {
      targetId: 'stacks', scenarioId: 'static-json', rpsMean: 100, rpsP50: 99,
      latencyMs: { p50: 1, p90: 2, p99: 3 }, errorRate: 0, cpuPercent: 98,
      spread: { min: 98, max: 102 }, rangeRatio: 0.04, runs: 3,
    }
    const malformed = parityChecks('stacks', 'static-json')
    malformed[0] = {
      ...malformed[0]!,
      after: { primary: { ...responseEvidence, bodySha256: 'not-a-digest' }, probes: [] },
    }
    expect(routingMeasurementPublicationIssues(
      [{ id: 'stacks' }],
      [{ id: 'static-json' }],
      [measurement],
      3,
      malformed,
    )).toEqual([
      'stacks:static-json contains invalid parity evidence',
      'stacks:static-json changed parity evidence under load',
    ])
    expect(routingMeasurementPublicationIssues(
      [{ id: 'stacks' }],
      [{ id: 'static-json' }],
      [measurement],
      3,
      parityChecks('stacks', 'static-json', 2),
    )).toContain('stacks:static-json did not retain 3 required parity check(s)')
  })
})

/**
 * Missing evidence must not become a valid aggregate (stacksjs/stacks#2470).
 *
 * The three holes were: the oha adapter substituting 0 for an absent latency
 * percentile, the runner dropping null CPU readings before taking a median,
 * and publication validating only the aggregate row. Each is covered here
 * against a row that would otherwise look publishable.
 */
describe('per-repeat publication gating', () => {
  const target = [{ id: 'stacks' }]
  const scenario = [{ id: 'static-json' }]

  /** A row that passes every aggregate check, so only the repeats can fail. */
  const row = (over = {}) => ({
    targetId: 'stacks',
    scenarioId: 'static-json',
    rpsMean: 100,
    rpsP50: 99,
    latencyMs: { p50: 1, p90: 2, p99: 3 },
    errorRate: 0,
    cpuPercent: 98,
    spread: { min: 98, max: 102 },
    rangeRatio: 0.04,
    runs: 3,
    ...over,
  })

  const repeat = (run: number, over = {}) => ({
    targetId: 'stacks',
    scenarioId: 'static-json',
    run,
    rpsMean: 100,
    rpsP50: 99,
    latencyMs: { p50: 1, p90: 2, p99: 3 },
    requests: 1000,
    errors: 0,
    cpuPercent: 98,
    rawBytes: 512,
    ...over,
  })

  const check = (rows: unknown[], repeats: unknown[]) =>
    routingMeasurementPublicationIssues(
      target as never,
      scenario as never,
      rows as never,
      3,
      parityChecks('stacks', 'static-json'),
      repeats as never,
    )

  it('accepts three complete valid repeats', () => {
    expect(check([row()], [repeat(1), repeat(2), repeat(3)])).toEqual([])
  })

  it('rejects a repeat with no CPU reading, which the aggregate hides', () => {
    // The aggregate row still carries a CPU number, because the old runner
    // medianed the readings it had. The repeat is the only place the gap shows.
    expect(check([row()], [repeat(1), repeat(2, { cpuPercent: null }), repeat(3)]))
      .toContain('stacks:static-json run 2 has no valid server CPU reading')
  })

  it('rejects a repeat with an absent latency percentile', () => {
    expect(check([row()], [repeat(1, { latencyMs: { p50: 1, p90: 2, p99: null } }), repeat(2), repeat(3)]))
      .toContain('stacks:static-json run 1 is missing a latency percentile')
  })

  it('rejects a repeat that served no requests', () => {
    // This is the one that used to contribute a free 0% error rate.
    expect(check([row()], [repeat(1), repeat(2), repeat(3, { requests: 0 })]))
      .toContain('stacks:static-json run 3 recorded no requests')
  })

  it('rejects a repeat whose raw output was not preserved', () => {
    expect(check([row()], [repeat(1, { rawBytes: 0 }), repeat(2), repeat(3)]))
      .toContain('stacks:static-json run 1 preserved no raw output')
  })

  it('rejects a malformed throughput measurement in one repeat', () => {
    expect(check([row()], [repeat(1), repeat(2, { rpsMean: Number.NaN }), repeat(3)]))
      .toContain('stacks:static-json run 2 has an invalid throughput measurement')
  })

  it('rejects more errors than requests', () => {
    expect(check([row()], [repeat(1, { requests: 10, errors: 11 }), repeat(2), repeat(3)]))
      .toContain('stacks:static-json run 1 has an invalid error count')
  })

  it('requires complete unique run identities', () => {
    // Two repeats both claiming run 1 is two measurements of one scheduled
    // run, or one measurement counted twice. Either way the set is not three.
    expect(check([row()], [repeat(1), repeat(1), repeat(3)]))
      .toContain('stacks:static-json did not retain 3 identified repeat(s)')
    expect(check([row()], [repeat(1), repeat(2)]))
      .toContain('stacks:static-json did not retain 3 identified repeat(s)')
    expect(check([row()], [repeat(1), repeat(2), repeat(4)]))
      .toContain('stacks:static-json did not retain 3 identified repeat(s)')
  })

  it('names a null aggregate rather than treating it as zero', () => {
    expect(check([row({ errorRate: null })], [repeat(1), repeat(2), repeat(3)]))
      .toContain('stacks:static-json recorded no requests, so it has no error rate')
    expect(check([row({ latencyMs: { p50: 1, p90: null, p99: 3 } })], [repeat(1), repeat(2), repeat(3)]))
      .toContain('stacks:static-json is missing a latency percentile')
  })

  it('stays backward compatible when no repeats are supplied', () => {
    // The argument is optional so the existing call sites and tests keep
    // working; supplying none means the aggregate checks alone apply.
    expect(check([row()], [])).toEqual([])
  })
})
