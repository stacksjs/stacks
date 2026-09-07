import { describe, expect, it } from 'bun:test'
import { routingMeasurementPublicationIssues, routingPublicationIssues } from './publication'

const publishable = {
  driverPublishable: true,
  dedicated: true,
  runtimeRequirement: { range: '1.4.1', matches: true },
  source: { revision: 'a'.repeat(40), dirty: false },
  warmupSeconds: 5,
  durationSeconds: 30,
  runs: 3,
  busyHostProcesses: [],
}

describe('routing benchmark publication profile', () => {
  it('accepts an isolated run with the full measurement windows', () => {
    expect(routingPublicationIssues(publishable)).toEqual([])
  })

  it('explains every unmet prerequisite', () => {
    expect(routingPublicationIssues({
      ...publishable,
      driverPublishable: false,
      dedicated: false,
      runtimeRequirement: { range: '1.4.1', matches: false },
      source: { revision: null, dirty: null },
      warmupSeconds: 1,
      durationSeconds: 10,
      runs: 1,
      busyHostProcesses: [{ pid: 42, cpuPercent: 90, command: 'compiler' }],
    })).toEqual([
      'load generator is not publishable',
      'BENCH_DEDICATED=1 is not set',
      'runtime does not match package.json engines.bun',
      'source revision is unavailable or the working tree is not clean',
      'warm-up is 1s; at least 5s is required',
      'measurement window is 10s; at least 30s is required',
      'only 1 run(s) were requested; at least 3 are required',
      'competing host processes were observed',
    ])
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
    )).toEqual([
      'missing was skipped',
      'stacks:static-json contains an invalid measurement',
      'stacks:static-json recorded request errors',
      'stacks:static-json has no valid server CPU reading',
      'stacks:static-json exceeded the 10% throughput stability range',
      'stacks:path-param did not complete 3 required run(s)',
    ])
  })
})
