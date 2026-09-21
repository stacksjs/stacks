import type { ListenSample } from './listen-process'
import type { PairedMetricSummary } from './paired'
import type { StartupSample } from './statistics'
import type { StartupGraphs } from './context'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { summarizePairedMetric, validatePairedSamples } from './paired'
import { summarizeStartupMetric, validateStartupSamples } from './statistics'
import { validateBuiltGraph } from './graph'

interface DiagnosticResult<TSample> {
  diagnosticOnly: boolean
  entries: { root: string, runtime: string }
  generatedAt: string
  host: {
    architecture: string
    cpuModel: string | null
    platform: string
    release: string
  }
  packages: {
    bunRouter: { declaredRange: string, name: string, version: string }
    frameworkRouter: { name: string, version: string }
  }
  pairs: number
  runtime: {
    requirement: { matches: boolean, range: string }
    version: string
  }
  samples: TSample[]
  schemaVersion: number
  source: {
    after: { dirty: boolean, fingerprint: string, revision: string }
    before: { dirty: boolean, fingerprint: string, revision: string }
    changedDuringRun: boolean
  }
  staticGraph: StartupGraphs & {
    byteDelta: number
    bytePercentChange: number
    fileCountDelta: number
  }
}

interface ImportResult extends DiagnosticResult<StartupSample> {
  importMs: PairedMetricSummary
  rssBytes: PairedMetricSummary
}

interface ReadyResult extends DiagnosticResult<ListenSample> {
  firstResponseMs: PairedMetricSummary
  listenMs: PairedMetricSummary
  rssBytes: PairedMetricSummary
}

export interface StartupReportOptions {
  importPath: string
  output: string
  readyPath: string
}

function isPositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function validateMetric(metric: PairedMetricSummary, pairs: number, name: string): void {
  if (!metric || !isPositive(metric.rootMedian) || !isPositive(metric.runtimeMedian) || !isPositive(metric.pairedMedianRatio))
    throw new Error(`${name} contains an invalid median or paired ratio`)
  if (!Number.isFinite(metric.medianDelta) || !Number.isFinite(metric.medianPercentChange))
    throw new Error(`${name} contains an invalid change`)
  if (!Array.isArray(metric.pairedRatios) || metric.pairedRatios.length !== pairs)
    throw new Error(`${name} must contain ${pairs} paired ratios`)
  const pairIds = metric.pairedRatios.map(row => row.pair)
  if (new Set(pairIds).size !== pairs || pairIds.some(pair => !Number.isSafeInteger(pair) || pair < 0 || pair >= pairs))
    throw new Error(`${name} contains malformed pair identities`)
  if (metric.pairedRatios.some(row => !isPositive(row.ratio)))
    throw new Error(`${name} contains an invalid paired ratio`)
  const signs = [metric.runtimeLowerPairs, metric.runtimeEqualPairs, metric.runtimeHigherPairs]
  if (signs.some(value => !Number.isSafeInteger(value) || value < 0) || signs.reduce((sum, value) => sum + value, 0) !== pairs)
    throw new Error(`${name} sign counts must add up to ${pairs}`)
}

function validateBase(result: DiagnosticResult<unknown>, label: string): void {
  if (result.schemaVersion !== 1)
    throw new Error(`${label} uses unsupported schema version ${result.schemaVersion}`)
  if (result.diagnosticOnly !== true)
    throw new Error(`${label} is not marked diagnostic-only`)
  if (!Number.isSafeInteger(result.pairs) || result.pairs < 15)
    throw new Error(`${label} has an invalid pair count`)
  if (result.source?.changedDuringRun !== false)
    throw new Error(`${label} source changed during measurement`)
  if (!result.source?.before?.revision || result.source.before.revision !== result.source?.after?.revision)
    throw new Error(`${label} has inconsistent source revisions`)
  validateBuiltGraph(result.staticGraph?.root, `${label} root graph`)
  validateBuiltGraph(result.staticGraph?.runtime, `${label} runtime graph`)
  const rootGraph = result.staticGraph.root
  const runtimeGraph = result.staticGraph.runtime
  const expectedByteDelta = runtimeGraph.totalBytes - rootGraph.totalBytes
  const expectedFileCountDelta = runtimeGraph.fileCount - rootGraph.fileCount
  const expectedPercentChange = ((runtimeGraph.totalBytes / rootGraph.totalBytes) - 1) * 100
  if (result.staticGraph.byteDelta !== expectedByteDelta
    || result.staticGraph.fileCountDelta !== expectedFileCountDelta
    || result.staticGraph.bytePercentChange !== expectedPercentChange)
    throw new Error(`${label} built graph deltas do not match the retained manifests`)
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function validateDerivedMetric(actual: PairedMetricSummary, expected: PairedMetricSummary, pairs: number, name: string): void {
  validateMetric(actual, pairs, name)
  if (!same(actual, expected))
    throw new Error(`${name} summary does not match its retained samples`)
}

function validateCombined(imported: ImportResult, ready: ReadyResult): void {
  validateBase(imported, 'Import diagnostic')
  validateBase(ready, 'Readiness diagnostic')
  const comparisons: Array<[string, unknown, unknown]> = [
    ['pair count', imported.pairs, ready.pairs],
    ['source revision', imported.source.before.revision, ready.source.before.revision],
    ['source fingerprint', imported.source.before.fingerprint, ready.source.before.fingerprint],
    ['runtime', imported.runtime, ready.runtime],
    ['host', imported.host, ready.host],
    ['package provenance', imported.packages, ready.packages],
    ['entry paths', imported.entries, ready.entries],
    ['root build graph', imported.staticGraph.root, ready.staticGraph.root],
    ['runtime build graph', imported.staticGraph.runtime, ready.staticGraph.runtime],
  ]
  for (const [name, left, right] of comparisons) {
    if (!same(left, right))
      throw new Error(`Startup diagnostics have mismatched ${name}`)
  }

  validateStartupSamples(imported.samples, imported.pairs)
  validatePairedSamples(ready.samples, ready.pairs)
  validateDerivedMetric(imported.importMs, summarizeStartupMetric(imported.samples, imported.pairs, 'importMs'), imported.pairs, 'Import time')
  validateDerivedMetric(imported.rssBytes, summarizeStartupMetric(imported.samples, imported.pairs, 'rssBytes'), imported.pairs, 'Import RSS')
  validateDerivedMetric(
    ready.listenMs,
    summarizePairedMetric(ready.samples, ready.pairs, 'listen time', sample => sample.listenMs),
    ready.pairs,
    'Listen time',
  )
  validateDerivedMetric(
    ready.firstResponseMs,
    summarizePairedMetric(ready.samples, ready.pairs, 'first response time', sample => sample.firstResponseMs),
    ready.pairs,
    'First response time',
  )
  validateDerivedMetric(
    ready.rssBytes,
    summarizePairedMetric(ready.samples, ready.pairs, 'RSS value', sample => sample.rssBytes),
    ready.pairs,
    'Ready-state RSS',
  )

  const responses = ready.samples.map(sample => JSON.stringify(sample.response))
  if (responses.some(response => response === undefined) || new Set(responses).size !== 1)
    throw new Error('Readiness samples contain inconsistent response evidence')
  const response = ready.samples[0]!.response!
  if (response.status !== 200 || response.mediaType !== 'application/json' || !/^[a-f\d]{64}$/.test(response.bodySha256))
    throw new Error('Readiness samples contain malformed response evidence')
}

function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

function formatBytes(value: number): string {
  return `${value.toLocaleString('en-US')} B (${(value / 1024 / 1024).toFixed(2)} MiB)`
}

function metricRow(name: string, metric: PairedMetricSummary, unit: 'ms' | 'bytes', pairs: number): string {
  const root = unit === 'ms' ? `${metric.rootMedian.toFixed(3)} ms` : formatBytes(metric.rootMedian)
  const runtime = unit === 'ms' ? `${metric.runtimeMedian.toFixed(3)} ms` : formatBytes(metric.runtimeMedian)
  return `| ${name} | ${root} | ${runtime} | ${formatPercent(metric.medianPercentChange)} | ${metric.pairedMedianRatio.toFixed(4)} | ${metric.runtimeLowerPairs} / ${metric.runtimeEqualPairs} / ${metric.runtimeHigherPairs} | ${pairs} |`
}

export function renderStartupReport(imported: ImportResult, ready: ReadyResult): string {
  validateCombined(imported, ready)
  const source = imported.source.before
  const rootGraph = imported.staticGraph.root
  const runtimeGraph = imported.staticGraph.runtime
  const frameworkRouter = imported.packages.frameworkRouter
  const bunRouter = imported.packages.bunRouter
  const response = ready.samples[0]!.response!
  const sourceState = source.dirty ? 'modified working tree' : 'clean working tree'
  const graphChange = ((runtimeGraph.totalBytes / rootGraph.totalBytes) - 1) * 100

  return `# Router startup diagnostic

> Diagnostic only. Developer machines and hosted runners are not dedicated benchmark hardware.

## Provenance

| Field | Value |
|---|---|
| Source | \`${source.revision}\` (${sourceState}) |
| Bun | ${imported.runtime.version} (required ${imported.runtime.requirement.range}, matched) |
| Host | ${imported.host.platform} ${imported.host.release}, ${imported.host.architecture}, ${imported.host.cpuModel} |
| Framework router | ${frameworkRouter.name} ${frameworkRouter.version} |
| bun-router | ${bunRouter.name} ${bunRouter.version} (declared ${bunRouter.declaredRange}) |
| Alternating pairs | ${imported.pairs} per diagnostic |

## Reachable built JavaScript

| Entry | Files | Bytes | Digest |
|---|---:|---:|---|
| Root | ${rootGraph.fileCount} | ${rootGraph.totalBytes.toLocaleString('en-US')} | \`${rootGraph.digest}\` |
| Runtime | ${runtimeGraph.fileCount} | ${runtimeGraph.totalBytes.toLocaleString('en-US')} | \`${runtimeGraph.digest}\` |

Runtime graph byte change: ${formatPercent(graphChange)}.

## Fresh-process import

| Metric | Root median | Runtime median | Median change | Paired median ratio | Runtime lower / equal / higher | Pairs |
|---|---:|---:|---:|---:|---:|---:|
${metricRow('Import time', imported.importMs, 'ms', imported.pairs)}
${metricRow('Settled RSS', imported.rssBytes, 'bytes', imported.pairs)}

## Spawn to verified response

| Metric | Root median | Runtime median | Median change | Paired median ratio | Runtime lower / equal / higher | Pairs |
|---|---:|---:|---:|---:|---:|---:|
${metricRow('Listen handshake', ready.listenMs, 'ms', ready.pairs)}
${metricRow('Verified response', ready.firstResponseMs, 'ms', ready.pairs)}
${metricRow('Ready-state RSS', ready.rssBytes, 'bytes', ready.pairs)}

## HTTP evidence

| Status | Media type | Body SHA-256 |
|---:|---|---|
| ${response.status} | ${response.mediaType} | \`${response.bodySha256}\` |
`
}

export function parseStartupReportOptions(args: readonly string[]): StartupReportOptions {
  const values: Record<string, string> = {}
  for (const argument of args) {
    const match = argument.match(/^--(import|ready|output)=(.+)$/)
    if (!match) throw new Error(`Unknown or incomplete startup report option: ${argument}`)
    values[match[1]!] = match[2]!
  }
  for (const name of ['import', 'ready', 'output']) {
    if (!values[name]) throw new Error(`Missing --${name}=... startup report option`)
  }
  return { importPath: values.import!, readyPath: values.ready!, output: values.output! }
}

export async function writeStartupReport(options: StartupReportOptions): Promise<string> {
  const [imported, ready] = await Promise.all([
    Bun.file(resolve(options.importPath)).json() as Promise<ImportResult>,
    Bun.file(resolve(options.readyPath)).json() as Promise<ReadyResult>,
  ])
  const report = renderStartupReport(imported, ready)
  const output = resolve(options.output)
  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(output, report)
  return report
}

if (import.meta.main) {
  const report = await writeStartupReport(parseStartupReportOptions(process.argv.slice(2)))
  console.log(report)
}
