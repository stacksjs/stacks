import { describe, expect, it } from 'bun:test'
import { routingPublicationIssues } from './publication'

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
})
