import type { BuiltGraph } from './graph'
import type { PairedMetricSummary } from './paired'
import type { SourceSnapshot } from './provenance'
import type { StartupSample } from './statistics'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { validateBuiltGraph } from './graph'
import { summarizeStartupMetric, validateStartupSamples } from './statistics'

export interface DatabaseRuntimeResult {
  diagnosticOnly: boolean
  entries: { root: string, runtime: string }
  generatedAt: string
  host: { architecture: string, cpuModel: string | null, platform: string, release: string }
  importMs: PairedMetricSummary
  packages: { database: { manifest: string, name: string, version: string } }
  pairs: number
  rssBytes: PairedMetricSummary
  runtime: { requirement: { matches: boolean, range: string }, version: string }
  samples: StartupSample[]
  schemaVersion: number
  source: { after: SourceSnapshot, before: SourceSnapshot, changedDuringRun: boolean }
  staticGraph: {
    byteDelta: number
    bytePercentChange: number
    fileCountDelta: number
    root: BuiltGraph
    runtime: BuiltGraph
  }
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

export function validateDatabaseRuntimeResult(result: DatabaseRuntimeResult): void {
  if (result.schemaVersion !== 1 || result.diagnosticOnly !== true)
    throw new Error('Database runtime diagnostic has an invalid schema or publication class')
  if (!Number.isSafeInteger(result.pairs) || result.pairs < 15)
    throw new Error('Database runtime diagnostic has an invalid pair count')
  if (result.runtime?.requirement?.matches !== true || !result.runtime.version)
    throw new Error('Database runtime diagnostic has invalid Bun provenance')
  if (!result.packages?.database?.name || !result.packages.database.version || !result.packages.database.manifest)
    throw new Error('Database runtime diagnostic has invalid package provenance')
  if (result.source?.changedDuringRun !== false
    || !result.source.before.revision
    || result.source.before.revision !== result.source.after.revision
    || result.source.before.fingerprint !== result.source.after.fingerprint)
    throw new Error('Database runtime diagnostic source changed during measurement')

  validateBuiltGraph(result.staticGraph.root, 'Database root graph')
  validateBuiltGraph(result.staticGraph.runtime, 'Database runtime graph')
  const root = result.staticGraph.root
  const runtime = result.staticGraph.runtime
  if (result.staticGraph.fileCountDelta !== runtime.fileCount - root.fileCount
    || result.staticGraph.byteDelta !== runtime.totalBytes - root.totalBytes
    || result.staticGraph.bytePercentChange !== ((runtime.totalBytes / root.totalBytes) - 1) * 100)
    throw new Error('Database runtime graph deltas do not match the retained manifests')

  validateStartupSamples(result.samples, result.pairs)
  if (!same(result.importMs, summarizeStartupMetric(result.samples, result.pairs, 'importMs')))
    throw new Error('Database import-time summary does not match its retained samples')
  if (!same(result.rssBytes, summarizeStartupMetric(result.samples, result.pairs, 'rssBytes')))
    throw new Error('Database RSS summary does not match its retained samples')
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
  return `| ${name} | ${root} | ${runtime} | ${formatPercent(metric.medianPercentChange)} | ${metric.runtimeLowerPairs} / ${metric.runtimeEqualPairs} / ${metric.runtimeHigherPairs} | ${pairs} |`
}

export function renderDatabaseRuntimeReport(result: DatabaseRuntimeResult): string {
  validateDatabaseRuntimeResult(result)
  const source = result.source.before
  const database = result.packages.database
  const root = result.staticGraph.root
  const runtime = result.staticGraph.runtime
  const sourceState = source.dirty ? 'modified working tree' : 'clean working tree'

  return `# Database runtime import diagnostic

> Diagnostic only. Hosted runners are not dedicated benchmark hardware.

## Provenance

| Field | Value |
|---|---|
| Source | \`${source.revision}\` (${sourceState}) |
| Bun | ${result.runtime.version} (required ${result.runtime.requirement.range}, matched) |
| Host | ${result.host.platform} ${result.host.release}, ${result.host.architecture}, ${result.host.cpuModel} |
| Package | ${database.name} ${database.version} |
| Alternating pairs | ${result.pairs} |

## Reachable built JavaScript

| Entry | Files | Bytes | Digest |
|---|---:|---:|---|
| Root | ${root.fileCount} | ${root.totalBytes.toLocaleString('en-US')} | \`${root.digest}\` |
| Runtime | ${runtime.fileCount} | ${runtime.totalBytes.toLocaleString('en-US')} | \`${runtime.digest}\` |

Runtime graph byte change: ${formatPercent(result.staticGraph.bytePercentChange)}.

## Fresh-process import

| Metric | Root median | Runtime median | Median change | Runtime lower / equal / higher | Pairs |
|---|---:|---:|---:|---:|---:|
${metricRow('Import time', result.importMs, 'ms', result.pairs)}
${metricRow('Settled RSS', result.rssBytes, 'bytes', result.pairs)}
`
}

export async function writeDatabaseRuntimeReport(input: string, output: string): Promise<string> {
  const result = await Bun.file(resolve(input)).json() as DatabaseRuntimeResult
  const report = renderDatabaseRuntimeReport(result)
  const resolvedOutput = resolve(output)
  mkdirSync(dirname(resolvedOutput), { recursive: true })
  writeFileSync(resolvedOutput, report)
  return report
}

if (import.meta.main) {
  const values = Object.fromEntries(process.argv.slice(2).map((argument) => {
    const match = argument.match(/^--(input|output)=(.+)$/)
    if (!match) throw new Error(`Unknown database report option: ${argument}`)
    return [match[1]!, match[2]!]
  }))
  if (!values.input || !values.output)
    throw new Error('Database report requires --input and --output')
  console.log(await writeDatabaseRuntimeReport(values.input, values.output))
}
