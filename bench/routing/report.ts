/**
 * Turns a run into the markdown that gets committed next to it.
 *
 * The machine block at the top is not decoration. A throughput number with no
 * CPU model, core count and Bun version attached cannot be reproduced or
 * argued with, and this repo does not publish numbers like that.
 */

import type { Scenario } from './scenarios'

export interface Measurement {
  targetId: string
  scenarioId: string
  /** Median of the repeated runs. */
  rpsMean: number
  rpsP50: number | null
  latencyMs: { p50: number, p90: number, p99: number }
  errorRate: number
  /** CPU time burned as a percentage of one core, over the whole run. */
  cpuPercent: number | null
  /** Lowest and highest rps across the repeats, so spread is visible. */
  spread: { min: number, max: number }
  runs: number
}

export interface RunMeta {
  startedAt: string
  driver: string
  publishable: boolean
  connections: number
  warmupSeconds: number
  durationSeconds: number
  runs: number
  machine: {
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

export function renderReport(input: ReportInput): string {
  const { meta, scenarios, targets, measurements } = input
  const lines: string[] = []

  lines.push('# Routing benchmark')
  lines.push('')
  if (!meta.publishable) {
    lines.push('> **Direction-only.** This run used the harness\'s built-in Bun load generator, which')
    lines.push('> shares the machine and the runtime with the server under test. Use `oha` or')
    lines.push('> `bombardier` for any number that leaves this directory.')
    lines.push('')
  }
  lines.push('| | |')
  lines.push('|---|---|')
  lines.push(`| Started | ${meta.startedAt} |`)
  lines.push(`| Load generator | \`${meta.driver}\`${meta.publishable ? '' : ' (direction-only)'} |`)
  lines.push(`| Connections | ${meta.connections} |`)
  lines.push(`| Window | ${meta.warmupSeconds}s warm-up discarded, ${meta.durationSeconds}s measured, ${meta.runs} run(s), median reported |`)
  lines.push(`| CPU | ${meta.machine.cpu} (${meta.machine.cores} cores) |`)
  lines.push(`| OS | ${meta.machine.platform} ${meta.machine.release} |`)
  lines.push(`| Bun | ${meta.machine.bun} |`)
  lines.push('')

  const skipped = targets.filter(t => t.skipped)
  if (skipped.length > 0) {
    lines.push('Skipped: ' + skipped.map(t => `**${t.label}** (${t.skipped})`).join(', ') + '.')
    lines.push('')
  }

  for (const scenario of scenarios) {
    const rows = measurements.filter(m => m.scenarioId === scenario.id)
    if (rows.length === 0) continue

    lines.push(`## ${scenario.title}`)
    lines.push('')
    lines.push(`\`${scenario.method} ${scenario.path}\``)
    lines.push('')
    lines.push('| Target | req/s | req/s p50 | spread | p50 ms | p90 ms | p99 ms | errors | CPU |')
    lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|')

    for (const row of rows) {
      const target = targets.find(t => t.id === row.targetId)
      lines.push([
        '',
        target?.label ?? row.targetId,
        fmt(row.rpsMean),
        row.rpsP50 == null ? '-' : fmt(row.rpsP50),
        `${fmt(row.spread.min)}-${fmt(row.spread.max)}`,
        fmt(row.latencyMs.p50, 2),
        fmt(row.latencyMs.p90, 2),
        fmt(row.latencyMs.p99, 2),
        `${(row.errorRate * 100).toFixed(2)}%`,
        row.cpuPercent == null ? '-' : `${fmt(row.cpuPercent)}%`,
        '',
      ].join(' | ').trim())
    }
    lines.push('')
  }

  lines.push('---')
  lines.push('')
  lines.push('Raw load-generator output for every run is in `raw/` beside this file.')
  lines.push('')
  return lines.join('\n')
}
