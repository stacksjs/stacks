/**
 * Turns a run into the markdown that gets committed next to it.
 *
 * The machine block at the top is not decoration. A throughput number with no
 * CPU model, core count and Bun version attached cannot be reproduced or
 * argued with, and this repo does not publish numbers like that.
 */

import type { Scenario } from './scenarios'
import type { SourceState } from './source'
import type { RelativeThroughput } from './statistics'
import type { RuntimeRequirement } from './runtime-version'
import type { StacksSourceModules } from './provenance'
import type { BusyProcess } from './host-load'
import { formatBusyProcess } from './host-load'
import { formatSourceState } from './source'
import { MAX_STABLE_RANGE } from './statistics'
import { formatRuntimeRequirement, runtimeMismatchWarning } from './runtime-version'

export interface Measurement {
  targetId: string
  scenarioId: string
  /** Median of the repeated runs. */
  rpsMean: number
  rpsP50: number | null
  latencyMs: { p50: number, p90: number, p99: number }
  errorRate: number
  /** CPU time as a percentage of one core during measured load, excluding warmup. */
  cpuPercent: number | null
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
  runtimeRequirement?: RuntimeRequirement
  driver: string
  driverVersion?: string | null
  publishable: boolean
  publicationIssues?: string[]
  connections: number
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

export function renderReport(input: ReportInput): string {
  const { meta, scenarios, targets, measurements } = input
  const lines: string[] = []

  lines.push('# Routing benchmark')
  lines.push('')
  if (!meta.publishable && meta.driver === 'builtin') {
    lines.push('> **Direction-only.** This run used the harness\'s built-in Bun load generator, which')
    lines.push('> shares the machine and the runtime with the server under test. Use `oha` or')
    lines.push('> `bombardier` for any number that leaves this directory.')
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
  lines.push(`| Load generator | \`${meta.driver}\`${meta.publishable ? '' : ' (direction-only)'} |`)
  lines.push(`| Load generator version | ${meta.driverVersion ?? 'unavailable'} |`)
  lines.push(`| Connections | ${meta.connections} |`)
  lines.push(`| Window | ${meta.warmupSeconds}s warm-up discarded, ${meta.durationSeconds}s measured, ${meta.runs} run(s), median reported |`)
  lines.push(`| Persistent query history | ${meta.persistentQueryLogging ? 'enabled (opt-in)' : 'disabled (production default)'} |`)
  lines.push(`| CPU | ${meta.machine.cpu} (${meta.machine.cores} cores) |`)
  lines.push(`| Architecture | ${meta.machine.arch} |`)
  lines.push(`| OS | ${meta.machine.platform} ${meta.machine.release} |`)
  lines.push(`| Bun | ${meta.machine.bun} |`)
  if (meta.runtimeRequirement)
    lines.push(`| Project Bun requirement | ${formatRuntimeRequirement(meta.runtimeRequirement)} |`)
  lines.push('')

  const skipped = targets.filter(t => t.skipped)
  if (skipped.length > 0) {
    lines.push('Skipped: ' + skipped.map(t => `**${t.label}** (${t.skipped})`).join(', ') + '.')
    lines.push('')
  }

  for (const scenario of scenarios) {
    const rows = measurements.filter(m => m.scenarioId === scenario.id)
    if (rows.length === 0) continue
    const hasRawComparison = rows.some(row => row.relativeToRaw != null)

    lines.push(`## ${scenario.title}`)
    lines.push('')
    lines.push(`\`${scenario.method} ${scenario.path}\``)
    lines.push('')
    const unstableRows = rows.filter(row => measurementRange(row) > MAX_STABLE_RANGE)
    if (unstableRows.length > 0) {
      const labels = unstableRows.map((row) => {
        const target = targets.find(target => target.id === row.targetId)
        return `**${target?.label ?? row.targetId}** (${fmt(measurementRange(row) * 100, 1)}% range)`
      })
      lines.push(`> **Unstable result.** ${labels.join(', ')} exceeded the ${fmt(MAX_STABLE_RANGE * 100)}% range limit. Treat this scenario as invalid and rerun on an isolated host.`)
      lines.push('')
    }
    lines.push(`| Target | req/s | req/s p50 | spread |${hasRawComparison ? ' Bun raw |' : ''} p50 ms | p90 ms | p99 ms | errors | CPU |`)
    lines.push(`|---|---:|---:|---:|${hasRawComparison ? '---:|' : ''}---:|---:|---:|---:|---:|`)

    for (const row of rows) {
      const target = targets.find(t => t.id === row.targetId)
      const cells = [
        '',
        target?.label ?? row.targetId,
        fmt(row.rpsMean),
        row.rpsP50 == null ? '-' : fmt(row.rpsP50),
        `${fmt(row.spread.min)}-${fmt(row.spread.max)} (${fmt(measurementRange(row) * 100, 1)}%)`,
      ]
      if (hasRawComparison) {
        const relative = row.relativeToRaw
        cells.push(relative
          ? `${fmt(relative.median * 100, 1)}% (${fmt(relative.spread.min * 100, 1)}%-${fmt(relative.spread.max * 100, 1)}%)`
          : '-')
      }
      cells.push(
        fmt(row.latencyMs.p50, 2),
        fmt(row.latencyMs.p90, 2),
        fmt(row.latencyMs.p99, 2),
        `${(row.errorRate * 100).toFixed(2)}%`,
        row.cpuPercent == null ? '-' : `${fmt(row.cpuPercent)}%`,
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
