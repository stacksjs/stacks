import type { SourceState } from '../routing/source'
import type { RuntimeRequirement } from '../routing/runtime-version'
import { formatSourceState } from '../routing/source'
import { formatRuntimeRequirement, runtimeMismatchWarning } from '../routing/runtime-version'

export interface MemorySample {
  elapsedMs: number
  phase: 'load' | 'idle'
  rssBytes: number
}

export interface MemoryMeasurement {
  targetId: string
  run: number
  settledRssBytes: number
  peakLoadRssBytes: number
  rpsMean: number
  requests: number
  errors: number
  requestRate: number
}

export interface MemoryRunMeta {
  startedAt: string
  source?: SourceState
  runtimeRequirement?: RuntimeRequirement
  driver: string
  publishable: boolean
  scenario: string
  connections: number
  loadSeconds: number
  idleSeconds: number
  sampleIntervalMs: number
  settleSeconds: number
  runs: number
  machine: {
    platform: string
    release: string
    cpu: string
    cores: number
    bun: string
  }
}

export interface MemoryReportInput {
  meta: MemoryRunMeta
  targets: Array<{ id: string, label: string, requestRate: number, skipped?: string }>
  measurements: MemoryMeasurement[]
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
}

export function rateAttainmentPercent(delivered: number, requested: number): number {
  return requested === 0 ? 0 : delivered / requested * 100
}

function mib(bytes: number): string {
  return (bytes / 1024 / 1024).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function integer(value: number): string {
  return Math.round(value).toLocaleString('en-US')
}

export function renderMemoryReport(input: MemoryReportInput): string {
  const { meta, targets, measurements } = input
  const lines: string[] = ['# Idle memory benchmark', '']

  if (!meta.publishable) {
    lines.push('> **Direction-only.** Publish only dedicated Linux x64 runs driven by `oha`.')
    lines.push('')
  }
  const runtimeWarning = runtimeMismatchWarning(meta.runtimeRequirement, meta.machine.bun)
  if (runtimeWarning) {
    lines.push(`> ${runtimeWarning}`)
    lines.push('')
  }

  lines.push('| | |')
  lines.push('|---|---|')
  lines.push(`| Started | ${meta.startedAt} |`)
  lines.push(`| Source at start | ${formatSourceState(meta.source)} |`)
  lines.push(`| Runtime | Bun ${meta.machine.bun} |`)
  if (meta.runtimeRequirement)
    lines.push(`| Project Bun requirement | ${formatRuntimeRequirement(meta.runtimeRequirement)} |`)
  lines.push(`| Scenario | \`${meta.scenario}\`, ${meta.connections} connections, fixed per-target request rates |`)
  lines.push(`| Method | ${meta.loadSeconds}s sustained load, ${meta.idleSeconds}s idle, ${meta.sampleIntervalMs}ms RSS sampling |`)
  lines.push(`| Settled window | Median of the final ${meta.settleSeconds}s of idle |`)
  lines.push(`| Repeats | ${meta.runs}, median reported |`)
  lines.push(`| Load generator | \`${meta.driver}\`${meta.publishable ? '' : ' (direction-only)'} |`)
  lines.push(`| CPU | ${meta.machine.cpu} (${meta.machine.cores} cores) |`)
  lines.push(`| OS | ${meta.machine.platform} ${meta.machine.release} |`)
  lines.push('')

  const skipped = targets.filter(target => target.skipped)
  if (skipped.length > 0) {
    lines.push('Skipped: ' + skipped.map(target => `**${target.label}** (${target.skipped})`).join(', ') + '.')
    lines.push('')
  }

  lines.push('| Target | Fixed req/s | Delivered req/s | Rate attained | Settled idle RSS MiB | Run spread MiB | Peak load RSS MiB | Errors |')
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|')
  for (const target of targets) {
    const rows = measurements.filter(row => row.targetId === target.id)
    if (rows.length === 0) continue
    const settled = rows.map(row => row.settledRssBytes)
    const delivered = median(rows.map(row => row.rpsMean))
    const attained = rateAttainmentPercent(delivered, target.requestRate)
    lines.push([
      '',
      target.label,
      integer(target.requestRate),
      integer(delivered),
      `${attained.toFixed(1)}%${attained >= 98 ? '' : ' (invalid)'}`,
      mib(median(settled)),
      `${mib(Math.min(...settled))}-${mib(Math.max(...settled))}`,
      mib(median(rows.map(row => row.peakLoadRssBytes))),
      integer(rows.reduce((total, row) => total + row.errors, 0)),
      '',
    ].join(' | ').trim())
  }
  lines.push('')
  lines.push('Lower settled idle RSS is better. Raw time-series samples and load-generator output are in `raw/`.')
  lines.push('')
  return lines.join('\n')
}
