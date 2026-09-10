/**
 * Turns a run into the markdown that gets committed next to it.
 *
 * The machine block at the top is not decoration. A throughput number with no
 * CPU model, core count and Bun version attached cannot be reproduced or
 * argued with, and this repo does not publish numbers like that.
 */

import type { LatencyPercentiles } from './drivers'
import type { Scenario } from './scenarios'
import type { SourceState } from './source'
import type { RelativeThroughput } from './statistics'
import type { RuntimeRequirement } from './runtime-version'
import type { StacksRuntimeDependencies, StacksSourceModules } from './provenance'
import type { BusyProcess } from './host-load'
import { formatBusyProcess } from './host-load'
import { formatSourceState } from './source'
import { MAX_STABLE_RANGE, MIN_RATE_ATTAINMENT } from './statistics'
import { formatRuntimeRequirement, runtimeMismatchWarning } from './runtime-version'

/**
 * One measured repeat, retained with the CPU reading taken during it.
 *
 * Repeats used to be reduced to an aggregate immediately, and null CPU
 * readings were dropped before the median was taken - so a repeat that
 * produced no CPU evidence left no trace, and the quality gate saw a complete
 * row (stacksjs/stacks#2470). Retaining them lets publication check each one
 * and name the run that failed.
 */
export interface RoutingRepeat {
  targetId: string
  scenarioId: string
  /** 1-based scheduled run ordinal, so a missing repeat is identifiable. */
  run: number
  rpsMean: number
  rpsP50: number | null
  latencyMs: LatencyPercentiles
  requests: number
  errors: number
  /** `null` when no CPU evidence was captured during this repeat. */
  cpuPercent: number | null
  /** Microseconds of server CPU per request served. `null` without evidence. */
  cpuMicrosPerRequest: number | null
  /** Delivered requests over requested, for fixed-rate runs. `null` otherwise. */
  rateAttained: number | null
  /** Bytes of raw tool output recorded for this repeat. */
  rawBytes: number
}

export interface Measurement {
  targetId: string
  scenarioId: string
  /** Median of the repeated runs. */
  rpsMean: number
  rpsP50: number | null
  /** Median across the repeats. A percentile is `null` unless every repeat measured it. */
  latencyMs: LatencyPercentiles
  /** Pooled errors over pooled requests. `null` when no requests were recorded. */
  errorRate: number | null
  /** CPU as a percentage of one core during measured load, excluding warmup.
   * `null` unless EVERY repeat produced a reading. */
  cpuPercent: number | null
  /** Median microseconds of server CPU per request. `null` unless every repeat measured it. */
  cpuMicrosPerRequest: number | null
  /** Lowest and highest per-request CPU cost across the repeats. */
  cpuCostSpread?: { min: number, max: number } | null
  /** Median share of the requested fixed rate that was delivered. `null` for saturating runs. */
  rateAttained: number | null
  /** Lowest and highest rps across the repeats, so spread is visible. */
  spread: { min: number, max: number }
  /** Full rps range divided by the median. */
  rangeRatio?: number
  /** Median and spread of run-paired throughput ratios against Bun raw. */
  relativeToRaw?: RelativeThroughput | null
  runs: number
}

export interface RunMeta {
  startedAt: string
  source?: SourceState
  sourceAtEnd?: SourceState
  stacksSourceModules?: StacksSourceModules
  stacksRuntimeDependencies?: StacksRuntimeDependencies
  runtimeRequirement?: RuntimeRequirement
  driver: string
  driverVersion?: string | null
  /** Where the load process runs relative to the target server. */
  loadTopology: 'same-host'
  peerVersions?: Record<string, string>
  publishable: boolean
  publicationIssues?: string[]
  connections: number
  /** Fixed requests per second held across every target, when one was requested. */
  requestRate?: number
  warmupSeconds: number
  durationSeconds: number
  runs: number
  persistentQueryLogging: boolean
  busyHostProcesses?: BusyProcess[]
  machine: {
    arch: string
    platform: string
    release: string
    cpu: string
    cores: number
    bun: string
  }
}

export interface ReportInput {
  meta: RunMeta
  scenarios: readonly Scenario[]
  targets: Array<{ id: string, label: string, skipped?: string }>
  measurements: Measurement[]
}

function fmt(n: number, digits = 0): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

function measurementRange(row: Measurement): number {
  if (row.rangeRatio != null)
    return row.rangeRatio
  if (!(row.rpsMean > 0))
    return Number.POSITIVE_INFINITY
  return (row.spread.max - row.spread.min) / row.rpsMean
}

/**
 * Spread of the per-request CPU cost, as a share of its median.
 *
 * A fixed-rate run pins throughput, so the throughput range is near zero for
 * every target whether the measurement was steady or not. The cost column is
 * what varies there, and it is what the stability limit has to watch.
 */
export function costRange(row: Measurement): number {
  const { cpuMicrosPerRequest, cpuCostSpread } = row
  if (cpuMicrosPerRequest == null || !(cpuMicrosPerRequest > 0) || !cpuCostSpread)
    return Number.POSITIVE_INFINITY
  return (cpuCostSpread.max - cpuCostSpread.min) / cpuMicrosPerRequest
}

/** The range the stability limit applies to for this run's mode. */
export function stabilityRange(row: Measurement, fixedRate: boolean): number {
  return fixedRate ? costRange(row) : measurementRange(row)
}

export function renderReport(input: ReportInput): string {
  const { meta, scenarios, targets, measurements } = input
  const lines: string[] = []

  lines.push('# Routing benchmark')
  lines.push('')
  if (!meta.publishable && meta.driver === 'builtin') {
    lines.push('> **Direction-only.** This run used the harness\'s built-in Bun load generator, which')
    lines.push('> shares the machine and the runtime with the server under test. Use `oha` for')
    lines.push('> any number that leaves this directory.')
    lines.push('')
  }
  if (meta.publicationIssues?.length) {
    lines.push(`> **Publication blockers.** ${meta.publicationIssues.join('; ')}.`)
    lines.push('')
  }
  const runtimeWarning = runtimeMismatchWarning(meta.runtimeRequirement, meta.machine.bun)
  if (runtimeWarning) {
    lines.push(`> ${runtimeWarning}`)
    lines.push('')
  }
  if (meta.busyHostProcesses?.length) {
    lines.push(`> **Busy-host override.** ${meta.busyHostProcesses.map(formatBusyProcess).join(', ')}. This run is direction-only and must not be published.`)
    lines.push('')
  }
  lines.push('| | |')
  lines.push('|---|---|')
  lines.push(`| Started | ${meta.startedAt} |`)
  lines.push(`| Source at start | ${formatSourceState(meta.source)} |`)
  lines.push(`| Source at end | ${formatSourceState(meta.sourceAtEnd)} |`)
  if (meta.stacksSourceModules) {
    const modules = Object.entries(meta.stacksSourceModules).map(([specifier, path]) => `\`${specifier}\`: \`${path}\``).join('<br>')
    lines.push(`| Stacks source modules | ${modules} |`)
  }
  if (meta.stacksRuntimeDependencies) {
    const dependencies = Object.entries(meta.stacksRuntimeDependencies)
      .map(([specifier, dependency]) => `\`${specifier}\`: ${dependency.version} at \`${dependency.path}\``)
      .join('<br>')
    lines.push(`| Stacks runtime dependencies | ${dependencies} |`)
  }
  lines.push(`| Load generator | \`${meta.driver}\`${meta.publishable ? '' : ' (direction-only)'} |`)
  lines.push(`| Load generator version | ${meta.driverVersion ?? 'unavailable'} |`)
  lines.push('| Load topology | same host as target server |')
  if (meta.peerVersions && Object.keys(meta.peerVersions).length > 0) {
    const versions = Object.entries(meta.peerVersions).map(([name, version]) => `\`${name}\`: ${version}`).join('<br>')
    lines.push(`| Peer framework versions | ${versions} |`)
  }
  lines.push(`| Connections | ${meta.connections} |`)
  if (meta.requestRate != null)
    lines.push(`| Request rate | fixed at ${fmt(meta.requestRate)} req/s for every target (cost profile) |`)
  lines.push(`| Window | ${meta.warmupSeconds}s warm-up discarded, ${meta.durationSeconds}s measured, ${meta.runs} run(s), median reported |`)
  lines.push(`| Persistent query history | ${meta.persistentQueryLogging ? 'enabled (opt-in)' : 'disabled (production default)'} |`)
  lines.push(`| CPU | ${meta.machine.cpu} (${meta.machine.cores} cores) |`)
  lines.push(`| Architecture | ${meta.machine.arch} |`)
  lines.push(`| OS | ${meta.machine.platform} ${meta.machine.release} |`)
  lines.push(`| Bun | ${meta.machine.bun} |`)
  if (meta.runtimeRequirement)
    lines.push(`| Project Bun requirement | ${formatRuntimeRequirement(meta.runtimeRequirement)} |`)
  lines.push('')

  if (meta.requestRate != null) {
    lines.push('Every target answered the same fixed request rate, so the comparable column is')
    lines.push('**CPU us/req** - microseconds of server CPU per request served. Lower is cheaper.')
    lines.push('A row that did not attain the requested rate is not a cheaper server, it is a')
    lines.push('slower one, and its cost figure is marked invalid rather than reported as a win.')
    lines.push('The CPU window includes the load generator\'s startup and drain, identically for')
    lines.push('every target, so read the rows against each other rather than as absolute costs.')
    lines.push('')
  }

  const skipped = targets.filter(t => t.skipped)
  if (skipped.length > 0) {
    lines.push('Skipped: ' + skipped.map(t => `**${t.label}** (${t.skipped})`).join(', ') + '.')
    lines.push('')
  }

  for (const scenario of scenarios) {
    const rows = measurements.filter(m => m.scenarioId === scenario.id)
    if (rows.length === 0) continue
    const fixedRate = meta.requestRate != null
    // The Bun raw column is a ratio of throughputs. At a fixed rate every
    // target delivers the same throughput by construction, so it would read
    // 100% for all of them and say nothing.
    const hasRawComparison = !fixedRate && rows.some(row => row.relativeToRaw != null)

    lines.push(`## ${scenario.title}`)
    lines.push('')
    lines.push(`\`${scenario.method} ${scenario.path}\``)
    lines.push('')
    const unstableRows = rows.filter(row => stabilityRange(row, fixedRate) > MAX_STABLE_RANGE)
    if (unstableRows.length > 0) {
      const labels = unstableRows.map((row) => {
        const target = targets.find(target => target.id === row.targetId)
        return `**${target?.label ?? row.targetId}** (${fmt(stabilityRange(row, fixedRate) * 100, 1)}% range)`
      })
      lines.push(`> **Unstable result.** ${labels.join(', ')} exceeded the ${fmt(MAX_STABLE_RANGE * 100)}% ${fixedRate ? 'cost' : 'throughput'} range limit. Treat this scenario as invalid and rerun on an isolated host.`)
      lines.push('')
    }
    const costColumns = fixedRate ? ' CPU us/req | cost spread | rate |' : ''
    lines.push(`| Target |${costColumns} req/s | req/s p50 | spread |${hasRawComparison ? ' Bun raw |' : ''} p50 ms | p90 ms | p99 ms | errors | CPU |`)
    lines.push(`|---|${fixedRate ? '---:|---:|---:|' : ''}---:|---:|---:|${hasRawComparison ? '---:|' : ''}---:|---:|---:|---:|---:|`)

    for (const row of rows) {
      const target = targets.find(t => t.id === row.targetId)
      const cells = [
        '',
        target?.label ?? row.targetId,
      ]
      if (fixedRate) {
        const attained = row.rateAttained
        // An unattained rate invalidates the cost, so the two travel together:
        // a target that could not keep up served fewer requests over the same
        // CPU window and would otherwise show up as the cheapest row.
        const comparable = attained != null && attained >= MIN_RATE_ATTAINMENT
        cells.push(
          row.cpuMicrosPerRequest == null
            ? '-'
            : `${fmt(row.cpuMicrosPerRequest, 2)}${comparable ? '' : ' (invalid)'}`,
          row.cpuCostSpread == null
            ? '-'
            : `${fmt(row.cpuCostSpread.min, 2)}-${fmt(row.cpuCostSpread.max, 2)} (${fmt(costRange(row) * 100, 1)}%)`,
          attained == null ? '-' : `${fmt(attained * 100, 1)}%${comparable ? '' : ' (invalid)'}`,
        )
      }
      cells.push(
        fmt(row.rpsMean),
        row.rpsP50 == null ? '-' : fmt(row.rpsP50),
        `${fmt(row.spread.min)}-${fmt(row.spread.max)} (${fmt(measurementRange(row) * 100, 1)}%)`,
      )
      if (hasRawComparison) {
        const relative = row.relativeToRaw
        cells.push(relative
          ? `${fmt(relative.median * 100, 1)}% (${fmt(relative.spread.min * 100, 1)}%-${fmt(relative.spread.max * 100, 1)}%)`
          : '-')
      }
      // A metric nothing measured renders as `-`, the same as the CPU column
      // already did. Rendering a null as 0.00 would put the best possible
      // latency in the table for a run that produced no latency evidence.
      const measured = (value: number | null, digits: number) => value == null ? '-' : fmt(value, digits)
      cells.push(
        measured(row.latencyMs.p50, 2),
        measured(row.latencyMs.p90, 2),
        measured(row.latencyMs.p99, 2),
        row.errorRate == null ? '-' : `${(row.errorRate * 100).toFixed(2)}%`,
        measured(row.cpuPercent, 0),
        '',
      )
      lines.push(cells.join(' | ').trim())
    }
    lines.push('')
  }

  lines.push('---')
  lines.push('')
  lines.push('Raw load-generator output for every run is in `raw/` beside this file.')
  lines.push('')
  return lines.join('\n')
}
