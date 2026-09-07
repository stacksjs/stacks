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
