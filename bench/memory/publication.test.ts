import { describe, expect, it } from 'bun:test'
import { EQUAL_RATE_API_PROFILE } from './profile'
import { memoryMeasurementPublicationIssues, memoryPublicationIssues } from './publication'

const publishable = {
  driverPublishable: true,
  driverVersion: 'oha 1.16.0',
  platform: 'linux',
  arch: 'x64',
  dedicated: true,
  runtimeRequirement: { range: '1.4.1', matches: true },
  source: { revision: 'a'.repeat(40), dirty: false },
  targetIds: EQUAL_RATE_API_PROFILE.map(target => target.targetId),
  peerVersions: { elysia: '1.4.30', express: '5.2.1', fastify: '5.12.3', hono: '4.13.5' },
  scenario: 'static-json',
  connections: 64,
  loadSeconds: 60,
  idleSeconds: 180,
  sampleIntervalMs: 100,
  settleSeconds: 10,
  runs: 3,
  busyHostProcesses: [],
}

describe('memory benchmark publication profile', () => {
  it('accepts an isolated, reproducible Linux x64 run', () => {
    expect(memoryPublicationIssues(publishable)).toEqual([])
  })

  it('explains every unmet prerequisite', () => {
    expect(memoryPublicationIssues({
      ...publishable,
      driverPublishable: false,
      driverVersion: null,
      platform: 'darwin',
      arch: 'arm64',
      dedicated: false,
      runtimeRequirement: { range: '1.4.1', matches: false },
      source: { revision: null, dirty: null },
      targetIds: ['stacks-warm'],
      peerVersions: {},
      scenario: 'db-roundtrip',
      connections: 16,
      loadSeconds: 10,
      idleSeconds: 20,
      sampleIntervalMs: 250,
      settleSeconds: 5,
      runs: 1,
      busyHostProcesses: [{ pid: 42, cpuPercent: 90, command: 'compiler' }],
    })).toEqual([
      'load generator is not publishable',
      'load generator version is unavailable',
      'host OS is darwin, not linux',
      'host architecture is arm64, not x64',
      'BENCH_DEDICATED=1 is not set',
      'runtime does not match package.json engines.bun',
      'source revision is unavailable or the working tree is not clean',
      'target set does not match the equal-rate API profile',
      'scenario is db-roundtrip, not static-json',
      'connection count is 16, not 64',
      'load window is 10s, not 60s',
      'idle window is 20s, not 180s',
      'sampling interval is 250ms, not 100ms',
      'settled window is 5s, not 10s',
      'only 1 fresh-process run(s) were requested; at least 3 are required',
      'competing host processes were observed',
    ])
  })

  it('rejects missing, extra, and duplicate comparison targets', () => {
    expect(memoryPublicationIssues({ ...publishable, targetIds: ['stacks-warm'] })).toContain('target set does not match the equal-rate API profile')
    expect(memoryPublicationIssues({ ...publishable, targetIds: [...publishable.targetIds, 'stacks-wal-full'] })).toContain('target set does not match the equal-rate API profile')
    expect(memoryPublicationIssues({ ...publishable, targetIds: publishable.targetIds.map(() => 'stacks-warm') })).toContain('target set does not match the equal-rate API profile')
  })

  it('rejects an unidentified peer framework build', () => {
    expect(memoryPublicationIssues({
      ...publishable,
      peerVersions: { ...publishable.peerVersions, hono: 'unavailable' },
    })).toContain('peer framework version is unavailable for hono')
  })

  it('accepts complete, stable, error-free fixed-rate measurements', () => {
    expect(memoryMeasurementPublicationIssues(
      [{ id: 'stacks-warm', requestRate: 25_000 }],
      [
        { targetId: 'stacks-warm', run: 1, requestRate: 25_000, settledRssBytes: 100, peakLoadRssBytes: 120, rpsMean: 24_500, requests: 24_500, errors: 0 },
        { targetId: 'stacks-warm', run: 2, requestRate: 25_000, settledRssBytes: 102, peakLoadRssBytes: 121, rpsMean: 24_750, requests: 24_750, errors: 0 },
        { targetId: 'stacks-warm', run: 3, requestRate: 25_000, settledRssBytes: 101, peakLoadRssBytes: 122, rpsMean: 25_000, requests: 25_000, errors: 0 },
      ],
      3,
    )).toEqual([])
  })

  it('rejects skipped, incomplete, invalid, failed, under-rate, and unstable measurements', () => {
    expect(memoryMeasurementPublicationIssues(
      [
        { id: 'express', requestRate: 25_000, skipped: 'dependency unavailable' },
        { id: 'stacks-warm', requestRate: 25_000 },
      ],
      [
        { targetId: 'stacks-warm', run: 1, requestRate: 25_000, settledRssBytes: 100, peakLoadRssBytes: 120, rpsMean: 23_000, requests: 23_000, errors: 1 },
        { targetId: 'stacks-warm', run: 1, requestRate: 25_000, settledRssBytes: 120, peakLoadRssBytes: 0, rpsMean: 24_750, requests: 24_750, errors: 0 },
      ],
      2,
    )).toEqual([
      'express was skipped',
      'stacks-warm completed 1 of 2 required run(s)',
      'stacks-warm contains an invalid measurement',
      'stacks-warm recorded 1 request error(s)',
      'stacks-warm missed 98% fixed-rate attainment in run(s) 1',
      'stacks-warm settled RSS exceeded the 10% stability range',
    ])
  })

  it('rejects targets and rates outside the declared comparison profile', () => {
    expect(memoryMeasurementPublicationIssues(
      [{ id: 'stacks-wal-full', requestRate: 40_000 }, { id: 'bun-raw', requestRate: 25_000 }],
      [],
      3,
    )).toEqual([
      'stacks-wal-full is not in the equal-rate API memory profile',
      'stacks-wal-full completed 0 of 3 required run(s)',
      'bun-raw completed 0 of 3 required run(s)',
    ])
    expect(memoryMeasurementPublicationIssues(
      [{ id: 'bun-raw', requestRate: 40_000 }],
      [],
      3,
    )).toEqual([
      'bun-raw requested 40000 req/s, not the profile rate of 25000 req/s',
      'bun-raw completed 0 of 3 required run(s)',
    ])
  })
})
