import { describe, expect, test } from 'bun:test'
import type { DatabaseRuntimeResult } from './database-report'
import type { StartupSample } from './statistics'
import { renderDatabaseRuntimeReport } from './database-report'
import { summarizeBuiltGraph } from './graph'
import { summarizeStartupMetric } from './statistics'

function result(): DatabaseRuntimeResult {
  const samples: StartupSample[] = Array.from({ length: 15 }, (_, pair) => [
    { importMs: 100 + pair, order: pair % 2, pair, rssBytes: 90_000_000 + pair, variant: 'root' as const },
    { importMs: 25 + pair, order: 1 - (pair % 2), pair, rssBytes: 45_000_000 + pair, variant: 'runtime' as const },
  ]).flat()
  const root = summarizeBuiltGraph([{ bytes: 1000, path: 'index.js', sha256: 'a'.repeat(64) }])
  const runtime = summarizeBuiltGraph([{ bytes: 250, path: 'runtime.js', sha256: 'b'.repeat(64) }])
  return {
    diagnosticOnly: true,
    entries: { root: 'database/dist/index.js', runtime: 'database/dist/runtime.js' },
    generatedAt: '2026-09-21T00:00:00.000Z',
    host: { architecture: 'arm64', cpuModel: 'test', platform: 'darwin', release: 'test' },
    importMs: summarizeStartupMetric(samples, 15, 'importMs'),
    packages: { database: { manifest: 'database/package.json', name: '@stacksjs/database', version: '1.0.0' } },
    pairs: 15,
    rssBytes: summarizeStartupMetric(samples, 15, 'rssBytes'),
    runtime: { requirement: { matches: true, range: '>=1.4.0' }, version: '1.4.2' },
    samples,
    schemaVersion: 1,
    source: {
      after: { dirty: false, fingerprint: 'fingerprint', revision: 'a'.repeat(40) },
      before: { dirty: false, fingerprint: 'fingerprint', revision: 'a'.repeat(40) },
      changedDuringRun: false,
    },
    staticGraph: {
      byteDelta: runtime.totalBytes - root.totalBytes,
      bytePercentChange: ((runtime.totalBytes / root.totalBytes) - 1) * 100,
      fileCountDelta: runtime.fileCount - root.fileCount,
      root,
      runtime,
    },
  }
}

describe('database runtime report', () => {
  test('renders provenance, graphs, and recomputed metrics', () => {
    const report = renderDatabaseRuntimeReport(result())
    expect(report).toContain('# Database runtime import diagnostic')
    expect(report).toContain('@stacksjs/database 1.0.0')
    expect(report).toContain('| Import time | 107.000 ms | 32.000 ms |')
    expect(report).toContain('| Settled RSS |')
  })

  test('rejects a summary that does not match retained samples', () => {
    const tampered = result()
    tampered.importMs.rootMedian += 1
    expect(() => renderDatabaseRuntimeReport(tampered)).toThrow('does not match its retained samples')
  })
})
