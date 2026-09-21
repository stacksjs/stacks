import { describe, expect, test } from 'bun:test'
import { summarizePairedMetric } from './paired'
import { parseStartupReportOptions, renderStartupReport } from './report'
import { summarizeStartupMetric } from './statistics'
import { summarizeBuiltGraph } from './graph'

function base(pairs = 15) {
  const response = { status: 200, mediaType: 'application/json', bodySha256: 'a'.repeat(64) }
  const rootGraph = summarizeBuiltGraph([{ path: 'index.js', bytes: 1000, sha256: 'a'.repeat(64) }])
  const runtimeGraph = summarizeBuiltGraph([{ path: 'runtime.js', bytes: 600, sha256: 'b'.repeat(64) }])
  return {
    schemaVersion: 1,
    diagnosticOnly: true,
    generatedAt: '2026-09-21T00:00:00.000Z',
    runtime: { version: '1.4.2', requirement: { range: '1.4.2', matches: true } },
    host: { platform: 'linux', release: '6.8', architecture: 'x64', cpuModel: 'Test CPU' },
    source: {
      before: { revision: 'a'.repeat(40), dirty: false, fingerprint: 'source' },
      after: { revision: 'a'.repeat(40), dirty: false, fingerprint: 'source' },
      changedDuringRun: false,
    },
    packages: {
      frameworkRouter: { name: '@stacksjs/router', version: '1.0.0' },
      bunRouter: { name: '@stacksjs/bun-router', version: '0.1.18', declaredRange: '^0.1.18' },
    },
    pairs,
    entries: { root: 'dist/index.js', runtime: 'dist/runtime.js' },
    staticGraph: {
      root: rootGraph,
      runtime: runtimeGraph,
      fileCountDelta: runtimeGraph.fileCount - rootGraph.fileCount,
      byteDelta: runtimeGraph.totalBytes - rootGraph.totalBytes,
      bytePercentChange: ((runtimeGraph.totalBytes / rootGraph.totalBytes) - 1) * 100,
    },
    samples: Array.from({ length: pairs }, (_, pair) => [
      { pair, order: pair % 2, variant: 'root' as const, response, importMs: 20, listenMs: 20, firstResponseMs: 20, rssBytes: 20 },
      { pair, order: 1 - (pair % 2), variant: 'runtime' as const, response, importMs: 18, listenMs: 18, firstResponseMs: 18, rssBytes: 18 },
    ]).flat(),
  }
}

function diagnostics() {
  const common = base()
  const imported = structuredClone(common)
  const ready = structuredClone(common)
  return {
    imported: {
      ...imported,
      importMs: summarizeStartupMetric(imported.samples, imported.pairs, 'importMs'),
      rssBytes: summarizeStartupMetric(imported.samples, imported.pairs, 'rssBytes'),
    },
    ready: {
      ...ready,
      listenMs: summarizePairedMetric(ready.samples, ready.pairs, 'listen time', sample => sample.listenMs),
      firstResponseMs: summarizePairedMetric(ready.samples, ready.pairs, 'first response time', sample => sample.firstResponseMs),
      rssBytes: summarizePairedMetric(ready.samples, ready.pairs, 'RSS value', sample => sample.rssBytes),
    },
  }
}

describe('startup diagnostic report', () => {
  test('renders provenance, paired metrics, graph size, and response evidence', () => {
    const { imported, ready } = diagnostics()
    const report = renderStartupReport(imported, ready)
    expect(report).toContain('Diagnostic only')
    expect(report).toContain('`aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa` (clean working tree)')
    expect(report).toContain('| Import time | 20.000 ms | 18.000 ms | -10.00% | 0.9000 | 15 / 0 / 0 | 15 |')
    expect(report).toContain('Runtime graph byte change: -40.00%.')
    expect(report).toContain(`\`${ 'a'.repeat(64) }\``)
  })

  test('rejects artifacts from different runs and incomplete evidence', () => {
    const { imported, ready } = diagnostics()
    ready.source.before.revision = 'b'.repeat(40)
    ready.source.after.revision = 'b'.repeat(40)
    expect(() => renderStartupReport(imported, ready)).toThrow('mismatched source revision')

    const incomplete = diagnostics()
    incomplete.ready.samples.pop()
    expect(() => renderStartupReport(incomplete.imported, incomplete.ready)).toThrow('Expected 30 paired samples')

    const changed = diagnostics()
    changed.ready.samples[0]!.response = { ...changed.ready.samples[0]!.response, status: 201 }
    expect(() => renderStartupReport(changed.imported, changed.ready)).toThrow('inconsistent response evidence')
  })

  test('rejects stored summaries that drift from retained samples', () => {
    const summary = diagnostics()
    summary.imported.importMs.rootMedian = 21
    expect(() => renderStartupReport(summary.imported, summary.ready)).toThrow('Import time summary does not match')

    const readiness = diagnostics()
    readiness.ready.samples[0]!.listenMs = 21
    expect(() => renderStartupReport(readiness.imported, readiness.ready)).toThrow('Listen time summary does not match')

    const rss = diagnostics()
    rss.ready.samples[0]!.rssBytes = 21
    expect(() => renderStartupReport(rss.imported, rss.ready)).toThrow('Ready-state RSS summary does not match')
  })

  test('rejects built graph summaries and deltas that drift from retained manifests', () => {
    const summary = diagnostics()
    summary.imported.staticGraph.root.totalBytes++
    expect(() => renderStartupReport(summary.imported, summary.ready)).toThrow('root graph summary does not match')

    const delta = diagnostics()
    delta.ready.staticGraph.byteDelta++
    expect(() => renderStartupReport(delta.imported, delta.ready)).toThrow('built graph deltas do not match')
  })

  test('requires explicit input and output paths', () => {
    expect(parseStartupReportOptions(['--import=a.json', '--ready=b.json', '--output=report.md'])).toEqual({
      importPath: 'a.json',
      readyPath: 'b.json',
      output: 'report.md',
    })
    expect(() => parseStartupReportOptions(['--import=a.json'])).toThrow('Missing --ready')
    expect(() => parseStartupReportOptions(['--format=json'])).toThrow('Unknown or incomplete')
  })
})
