import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import process from 'node:process'

interface MetricSummary {
  medianDelta: number
  medianPercentChange: number
  pairedMedianRatio: number
  pairedRatios: Array<{ pair: number, ratio: number }>
  rootMedian: number
  runtimeEqualPairs: number
  runtimeHigherPairs: number
  runtimeLowerPairs: number
  runtimeMedian: number
}

interface ResponseEvidence {
  bodySha256: string
  mediaType: string
  status: number
}

interface ReportSample {
  pair: number
  response?: ResponseEvidence
  variant: string
}

interface DiagnosticResult {
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
  samples: ReportSample[]
  schemaVersion: number
  source: {
    after: { dirty: boolean, fingerprint: string, revision: string }
    before: { dirty: boolean, fingerprint: string, revision: string }
    changedDuringRun: boolean
  }
  staticGraph: {
    root: { digest: string, fileCount: number, totalBytes: number }
    runtime: { digest: string, fileCount: number, totalBytes: number }
  }
}

interface ImportResult extends DiagnosticResult {
  importMs: MetricSummary
  rssBytes: MetricSummary
}

interface ReadyResult extends DiagnosticResult {
  firstResponseMs: MetricSummary
  listenMs: MetricSummary
  rssBytes: MetricSummary
}

export interface StartupReportOptions {
  importPath: string
  output: string
  readyPath: string
}

function isPositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function validateMetric(metric: MetricSummary, pairs: number, name: string): void {
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

function validateSamples(result: DiagnosticResult, label: string): void {
  if (!Array.isArray(result.samples) || result.samples.length !== result.pairs * 2)
    throw new Error(`${label} must contain ${result.pairs * 2} samples`)
  for (let pair = 0; pair < result.pairs; pair++) {
    const rows = result.samples.filter(sample => sample.pair === pair)
    if (rows.length !== 2 || new Set(rows.map(row => row.variant)).size !== 2)
      throw new Error(`${label} pair ${pair} is incomplete`)
  }
}

function validateBase(result: DiagnosticResult, label: string): void {
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
  if (!result.staticGraph?.root?.digest || !result.staticGraph?.runtime?.digest)
    throw new Error(`${label} is missing built graph evidence`)
  validateSamples(result, label)
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
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

  validateMetric(imported.importMs, imported.pairs, 'Import time')
  validateMetric(imported.rssBytes, imported.pairs, 'Import RSS')
  validateMetric(ready.listenMs, ready.pairs, 'Listen time')
  validateMetric(ready.firstResponseMs, ready.pairs, 'First response time')
  validateMetric(ready.rssBytes, ready.pairs, 'Ready-state RSS')

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

function metricRow(name: string, metric: MetricSummary, unit: 'ms' | 'bytes', pairs: number): string {
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
