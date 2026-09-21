import type { Target } from '../routing/targets'
import type { PeerMetricSummary, PeerStartupMetric, PeerStartupSample } from './peer-statistics'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { selectedPeerPackages } from '../routing/peer-versions'
import { percentile, summarizePeerStartupMetric, validatePeerStartupSamples } from './peer-statistics'

interface SourceSnapshot {
  dirty: boolean
  fingerprint: string
  revision: string
}

export interface PeerStartupResult {
  diagnosticOnly: boolean
  firstResponseMs: PeerMetricSummary[]
  frameworkPackages: {
    bunRouter: { declaredRange: string, name: string, version: string }
    frameworkRouter: { name: string, version: string }
  }
  generatedAt: string
  host: {
    architecture: string
    cpuModel: string | null
    logicalCpuCount: number
    platform: string
    release: string
    totalMemoryBytes: number
  }
  listenMs: PeerMetricSummary[]
  peerVersions: Record<string, string>
  rssBytes: PeerMetricSummary[]
  runs: number
  runtime: {
    requirement: { matches: boolean, range: string }
    version: string
  }
  samples: PeerStartupSample[]
  scenario: {
    expectedBodySha256: string
    expectedMediaType: string
    expectedStatus: number
    id: string
    method: string
    path: string
  }
  schemaVersion: number
  source: {
    after: SourceSnapshot
    before: SourceSnapshot
    changedDuringRun: boolean
  }
  stacksRuntimeDependencies: Record<string, { path: string, version: string }>
  stacksSourceModules: Record<string, string>
  targets: Target[]
}

export interface PeerStartupReportOptions {
  input: string
  output: string
}

const METRICS: readonly PeerStartupMetric[] = ['listenMs', 'firstResponseMs', 'rssBytes']

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function validateVersions(result: PeerStartupResult, targetIds: readonly string[]): void {
  const packageNames = selectedPeerPackages(targetIds)
  if (!same(Object.keys(result.peerVersions).sort(), [...packageNames].sort()))
    throw new Error('Peer startup result has inconsistent peer version keys')
  for (const packageName of packageNames) {
    const version = result.peerVersions[packageName]
    if (!version || version === 'unavailable' || !/^\d+\.\d+\.\d+(?:[-+].+)?$/.test(version))
      throw new Error(`Peer startup result has no exact ${packageName} version`)
  }
}

function validateMetric(result: PeerStartupResult, targetIds: readonly string[], metric: PeerStartupMetric): void {
  const expected = summarizePeerStartupMetric(result.samples, result.runs, targetIds, metric)
  if (!same(result[metric], expected))
    throw new Error(`Peer startup ${metric} summary does not match its samples`)
}

export function validatePeerStartupResult(result: PeerStartupResult): void {
  if (result.schemaVersion !== 1)
    throw new Error(`Peer startup result uses unsupported schema version ${result.schemaVersion}`)
  if (result.diagnosticOnly !== true)
    throw new Error('Peer startup result is not marked diagnostic-only')
  if (!Number.isSafeInteger(result.runs) || result.runs < 15)
    throw new Error('Peer startup result requires at least 15 complete runs')
  if (!Array.isArray(result.targets) || result.targets.length < 2)
    throw new Error('Peer startup result requires at least two targets')
  const targetIds = result.targets.map(target => target.id)
  if (targetIds.some(id => !id) || new Set(targetIds).size !== targetIds.length || !targetIds.includes('bun-raw'))
    throw new Error('Peer startup result requires unique target IDs including bun-raw')
  if (result.targets.some(target => !target.label || !target.server))
    throw new Error('Peer startup result contains an incomplete target definition')
  if (!result.runtime?.version || result.runtime.requirement?.matches !== true || !result.runtime.requirement.range)
    throw new Error('Peer startup result has invalid runtime provenance')
  if (result.source?.changedDuringRun !== false
    || !result.source.before?.revision
    || result.source.before.revision !== result.source.after?.revision
    || result.source.before.fingerprint !== result.source.after?.fingerprint)
    throw new Error('Peer startup source changed during measurement')
  if (result.scenario?.id !== 'static-json'
    || result.scenario.method !== 'GET'
    || result.scenario.path !== '/bench/json'
    || result.scenario.expectedStatus !== 200
    || result.scenario.expectedMediaType !== 'application/json'
    || !/^[a-f\d]{64}$/.test(result.scenario.expectedBodySha256))
    throw new Error('Peer startup result has invalid scenario evidence')
  if (!result.frameworkPackages?.frameworkRouter?.version || !result.frameworkPackages?.bunRouter?.version)
    throw new Error('Peer startup result is missing framework package provenance')
  if (!result.stacksSourceModules || Object.keys(result.stacksSourceModules).length === 0
    || !result.stacksRuntimeDependencies || Object.keys(result.stacksRuntimeDependencies).length === 0)
    throw new Error('Peer startup result is missing Stacks source provenance')

  validateVersions(result, targetIds)
  validatePeerStartupSamples(result.samples, result.runs, targetIds)
  const response = result.samples[0]!.response
  if (response.status !== result.scenario.expectedStatus
    || response.mediaType !== result.scenario.expectedMediaType
    || response.bodySha256 !== result.scenario.expectedBodySha256)
    throw new Error('Peer startup response evidence does not match the scenario')
  for (const metric of METRICS)
    validateMetric(result, targetIds, metric)
}

function formatBytes(value: number): string {
  return `${(value / 1024 / 1024).toFixed(2)} MiB`
}

function formatMetric(value: number, metric: PeerStartupMetric): string {
  return metric === 'rssBytes' ? formatBytes(value) : `${value.toFixed(3)} ms`
}

function metricRows(result: PeerStartupResult, metric: PeerStartupMetric): string {
  const summaries = result[metric]
  return result.targets.map((target) => {
    const summary = summaries.find(row => row.targetId === target.id)!
    const values = result.samples.filter(sample => sample.targetId === target.id).map(sample => sample[metric])
    const ratios = summary.pairedRatios.map(row => row.ratio)
    const valueIqr = `${formatMetric(percentile(values, 0.25), metric)} - ${formatMetric(percentile(values, 0.75), metric)}`
    const ratioIqr = `${percentile(ratios, 0.25).toFixed(4)} - ${percentile(ratios, 0.75).toFixed(4)}`
    return `| ${target.label} | ${formatMetric(summary.median, metric)} | ${valueIqr} | ${summary.pairedMedianRatio.toFixed(4)} | ${ratioIqr} | ${summary.targetLowerRuns} / ${summary.targetEqualRuns} / ${summary.targetHigherRuns} |`
  }).join('\n')
}

function processPositionExposure(result: PeerStartupResult): { maximum: number, minimum: number } {
  const counts = result.targets.flatMap(target => Array.from({ length: result.targets.length }, (_, order) =>
    result.samples.filter(sample => sample.targetId === target.id && sample.order === order).length))
  return { minimum: Math.min(...counts), maximum: Math.max(...counts) }
}

function targetVersion(result: PeerStartupResult, target: Target): string {
  if (target.id.startsWith('stacks')) return result.frameworkPackages.frameworkRouter.version
  if (target.id === 'bun-raw') return result.runtime.version
  return result.peerVersions[target.id] ?? 'unknown'
}

export function renderPeerStartupReport(result: PeerStartupResult): string {
  validatePeerStartupResult(result)
  const source = result.source.before
  const sourceState = source.dirty ? 'modified working tree' : 'clean working tree'
  const bunRouter = result.frameworkPackages.bunRouter
  const positionExposure = processPositionExposure(result)

  return `# Peer server startup diagnostic

> Diagnostic only. Hosted runners are shared infrastructure, so this report is evidence for optimization rather than a public ranking.

## Provenance

| Field | Value |
|---|---|
| Source | \`${source.revision}\` (${sourceState}) |
| Bun | ${result.runtime.version} (required ${result.runtime.requirement.range}, matched) |
| Host | ${result.host.platform} ${result.host.release}, ${result.host.architecture}, ${result.host.cpuModel} |
| bun-router | ${bunRouter.version} (declared ${bunRouter.declaredRange}) |
| Complete balanced cycles | ${result.runs} |
| Process position exposure | ${positionExposure.minimum}-${positionExposure.maximum} samples per target and position |
| Response | ${result.scenario.expectedStatus} ${result.scenario.expectedMediaType}, \`${result.scenario.expectedBodySha256}\` |

## Targets

| Target | Version | Fixture |
|---|---|---|
${result.targets.map(target => `| ${target.label} | ${targetVersion(result, target)} | \`${target.server}\` |`).join('\n')}

Ratios are paired to Bun raw within the same cycle. A ratio below 1 uses less time or memory. Sign counts are target lower / equal / higher than Bun raw.

## Spawn to listen

| Target | Median | p25-p75 | Paired median ratio | Paired ratio p25-p75 | Lower / equal / higher |
|---|---:|---:|---:|---:|---:|
${metricRows(result, 'listenMs')}

## Spawn to verified response

| Target | Median | p25-p75 | Paired median ratio | Paired ratio p25-p75 | Lower / equal / higher |
|---|---:|---:|---:|---:|---:|
${metricRows(result, 'firstResponseMs')}

## Ready-state RSS

| Target | Median | p25-p75 | Paired median ratio | Paired ratio p25-p75 | Lower / equal / higher |
|---|---:|---:|---:|---:|---:|
${metricRows(result, 'rssBytes')}
`
}

export function parsePeerStartupReportOptions(args: readonly string[]): PeerStartupReportOptions {
  const values: Record<string, string> = {}
  for (const argument of args) {
    const match = argument.match(/^--(input|output)=(.+)$/)
    if (!match) throw new Error(`Unknown or incomplete peer startup report option: ${argument}`)
    values[match[1]!] = match[2]!
  }
  for (const name of ['input', 'output']) {
    if (!values[name]) throw new Error(`Missing --${name}=... peer startup report option`)
  }
  return { input: values.input!, output: values.output! }
}

export async function writePeerStartupReport(options: PeerStartupReportOptions): Promise<string> {
  const result = await Bun.file(resolve(options.input)).json() as PeerStartupResult
  const report = renderPeerStartupReport(result)
  const output = resolve(options.output)
  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(output, report)
  return report
}

if (import.meta.main) {
  const report = await writePeerStartupReport(parsePeerStartupReportOptions(process.argv.slice(2)))
  console.log(report)
}
