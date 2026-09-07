import { describe, expect, it } from 'bun:test'
import { memoryPublicationIssues } from './publication'

const publishable = {
  driverPublishable: true,
  platform: 'linux',
  arch: 'x64',
  dedicated: true,
  runtimeRequirement: { range: '1.4.1', matches: true },
  source: { revision: 'a'.repeat(40), dirty: false },
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
      platform: 'darwin',
      arch: 'arm64',
      dedicated: false,
      runtimeRequirement: { range: '1.4.1', matches: false },
      source: { revision: null, dirty: null },
      runs: 1,
      busyHostProcesses: [{ pid: 42, cpuPercent: 90, command: 'compiler' }],
    })).toEqual([
      'load generator is not publishable',
      'host OS is darwin, not linux',
      'host architecture is arm64, not x64',
      'BENCH_DEDICATED=1 is not set',
      'runtime does not match package.json engines.bun',
      'source revision is unavailable or the working tree is not clean',
      'only 1 fresh-process run(s) were requested; at least 3 are required',
      'competing host processes were observed',
    ])
  })
})
