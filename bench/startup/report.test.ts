import { describe, expect, test } from 'bun:test'
import { parseStartupReportOptions, renderStartupReport } from './report'

function metric(pairs = 15) {
  return {
    rootMedian: 20,
    runtimeMedian: 18,
    medianDelta: -2,
    medianPercentChange: -10,
    pairedMedianRatio: 0.9,
    pairedRatios: Array.from({ length: pairs }, (_, pair) => ({ pair, ratio: 0.9 })),
    runtimeLowerPairs: pairs,
    runtimeEqualPairs: 0,
    runtimeHigherPairs: 0,
  }
}

function base(pairs = 15) {
  const response = { status: 200, mediaType: 'application/json', bodySha256: 'a'.repeat(64) }
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
      root: { digest: 'root', fileCount: 10, totalBytes: 1000 },
      runtime: { digest: 'runtime', fileCount: 5, totalBytes: 600 },
    },
    samples: Array.from({ length: pairs }, (_, pair) => [
      { pair, order: pair % 2, variant: 'root', response },
      { pair, order: 1 - (pair % 2), variant: 'runtime', response },
    ]).flat(),
  }
}

function diagnostics() {
  const common = base()
  return {
    imported: { ...structuredClone(common), importMs: metric(), rssBytes: metric() },
    ready: { ...structuredClone(common), listenMs: metric(), firstResponseMs: metric(), rssBytes: metric() },
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
    expect(() => renderStartupReport(incomplete.imported, incomplete.ready)).toThrow('must contain 30 samples')

    const changed = diagnostics()
    changed.ready.samples[0]!.response = { ...changed.ready.samples[0]!.response, status: 201 }
    expect(() => renderStartupReport(changed.imported, changed.ready)).toThrow('inconsistent response evidence')
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
