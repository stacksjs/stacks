import { describe, expect, test } from 'bun:test'
import type { PeerStartupResult } from './peer-report'
import type { PeerStartupSample } from './peer-statistics'
import { parsePeerStartupReportOptions, renderPeerStartupReport } from './peer-report'
import { summarizePeerStartupMetric } from './peer-statistics'

function result(): PeerStartupResult {
  const targets = [
    { id: 'stacks', label: 'Stacks', server: 'stacks.ts' },
    { id: 'bun-raw', label: 'Bun.serve baseline', server: 'bun-raw.ts' },
  ]
  const response = { status: 200, mediaType: 'application/json', bodySha256: 'a'.repeat(64) }
  const samples: PeerStartupSample[] = Array.from({ length: 15 }, (_, run) => [
    { run, order: run % 2, targetId: 'stacks', listenMs: 20, firstResponseMs: 22, rssBytes: 200, response },
    { run, order: 1 - (run % 2), targetId: 'bun-raw', listenMs: 10, firstResponseMs: 11, rssBytes: 100, response },
  ]).flat()
  const targetIds = targets.map(target => target.id)
  return {
    schemaVersion: 1,
    diagnosticOnly: true,
    generatedAt: '2026-09-21T00:00:00.000Z',
    runtime: { version: '1.4.2', requirement: { range: '1.4.2', matches: true } },
    host: {
      platform: 'linux', release: '6.8', architecture: 'x64', cpuModel: 'Test CPU', logicalCpuCount: 4, totalMemoryBytes: 1000,
    },
    source: {
      before: { revision: 'a'.repeat(40), dirty: false, fingerprint: 'source' },
      after: { revision: 'a'.repeat(40), dirty: false, fingerprint: 'source' },
      changedDuringRun: false,
    },
    scenario: {
      id: 'static-json', method: 'GET', path: '/bench/json', expectedStatus: 200, expectedMediaType: 'application/json', expectedBodySha256: 'a'.repeat(64),
    },
    runs: 15,
    targets,
    peerVersions: {},
    frameworkPackages: {
      frameworkRouter: { name: '@stacksjs/router', version: '1.0.0' },
      bunRouter: { name: '@stacksjs/bun-router', version: '0.1.18', declaredRange: '^0.1.18' },
    },
    stacksSourceModules: { '@stacksjs/router': 'storage/framework/core/router/src/index.ts' },
    stacksRuntimeDependencies: { '@stacksjs/bun-router': { version: '0.1.18', path: 'node_modules/@stacksjs/bun-router/dist/index.js' } },
    listenMs: summarizePeerStartupMetric(samples, 15, targetIds, 'listenMs'),
    firstResponseMs: summarizePeerStartupMetric(samples, 15, targetIds, 'firstResponseMs'),
    rssBytes: summarizePeerStartupMetric(samples, 15, targetIds, 'rssBytes'),
    samples,
  }
}

describe('peer startup diagnostic report', () => {
  test('renders validated paired readiness and memory evidence', () => {
    const report = renderPeerStartupReport(result())
    expect(report).toContain('Diagnostic only')
    expect(report).toContain('`aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa` (clean working tree)')
    expect(report).toContain('| Process position exposure | 7-8 samples per target and position |')
    expect(report).toContain('| Stacks | 20.000 ms | 20.000 ms - 20.000 ms | 2.0000 | 2.0000 - 2.0000 | 0 / 0 / 15 |')
    expect(report).toContain('| Stacks | 0.00 MiB | 0.00 MiB - 0.00 MiB | 2.0000 | 2.0000 - 2.0000 | 0 / 0 / 15 |')
    expect(report).toContain(`\`${ 'a'.repeat(64) }\``)
  })

  test('rejects changed source, incomplete samples, and summary drift', () => {
    const changed = result()
    changed.source.after.fingerprint = 'changed'
    expect(() => renderPeerStartupReport(changed)).toThrow('source changed')

    const incomplete = result()
    incomplete.samples.pop()
    expect(() => renderPeerStartupReport(incomplete)).toThrow('Expected 30')

    const drift = result()
    drift.listenMs[0]!.median = 1
    expect(() => renderPeerStartupReport(drift)).toThrow('summary does not match')
  })

  test('requires explicit input and output paths', () => {
    expect(parsePeerStartupReportOptions(['--input=peers.json', '--output=peers.md'])).toEqual({
      input: 'peers.json',
      output: 'peers.md',
    })
    expect(() => parsePeerStartupReportOptions(['--input=peers.json'])).toThrow('Missing --output')
    expect(() => parsePeerStartupReportOptions(['--format=json'])).toThrow('Unknown or incomplete')
  })
})
