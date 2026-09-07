import { describe, expect, it } from 'bun:test'
import { memoryMeasurementPublicationIssues, memoryPublicationIssues } from './publication'

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

  it('accepts complete, stable, error-free fixed-rate measurements', () => {
    expect(memoryMeasurementPublicationIssues(
      [{ id: 'stacks', requestRate: 100 }],
      [
        { targetId: 'stacks', run: 1, requestRate: 100, settledRssBytes: 100, peakLoadRssBytes: 120, rpsMean: 98, requests: 98, errors: 0 },
        { targetId: 'stacks', run: 2, requestRate: 100, settledRssBytes: 102, peakLoadRssBytes: 121, rpsMean: 99, requests: 99, errors: 0 },
        { targetId: 'stacks', run: 3, requestRate: 100, settledRssBytes: 101, peakLoadRssBytes: 122, rpsMean: 100, requests: 100, errors: 0 },
      ],
      3,
    )).toEqual([])
  })

  it('rejects skipped, incomplete, invalid, failed, under-rate, and unstable measurements', () => {
    expect(memoryMeasurementPublicationIssues(
      [
        { id: 'missing', requestRate: 100, skipped: 'dependency unavailable' },
        { id: 'stacks', requestRate: 100 },
      ],
      [
        { targetId: 'stacks', run: 1, requestRate: 100, settledRssBytes: 100, peakLoadRssBytes: 120, rpsMean: 97, requests: 97, errors: 1 },
        { targetId: 'stacks', run: 1, requestRate: 100, settledRssBytes: 120, peakLoadRssBytes: 0, rpsMean: 99, requests: 99, errors: 0 },
      ],
      2,
    )).toEqual([
      'missing was skipped',
      'stacks completed 1 of 2 required run(s)',
      'stacks contains an invalid measurement',
      'stacks recorded 1 request error(s)',
      'stacks missed 98% fixed-rate attainment in run(s) 1',
      'stacks settled RSS exceeded the 10% stability range',
    ])
  })
})
