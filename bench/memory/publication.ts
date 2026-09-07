import type { BusyProcess } from '../routing/host-load'
import type { RuntimeRequirement } from '../routing/runtime-version'
import type { SourceState } from '../routing/source'
import type { MemoryMeasurement } from './report'
import { MAX_STABLE_RANGE, relativeRange } from '../routing/statistics'
import { EQUAL_RATE_API_PROFILE } from './profile'

export const MIN_MEMORY_RATE_ATTAINMENT = 0.98

export interface MemoryPublicationTarget {
  id: string
  requestRate: number
  skipped?: string
}

export interface MemoryPublicationProfile {
  driverPublishable: boolean
  driverVersion: string | null
  platform: string
  arch: string
  dedicated: boolean
  runtimeRequirement?: RuntimeRequirement
  source?: SourceState
  scenario: string
  connections: number
  loadSeconds: number
  idleSeconds: number
  sampleIntervalMs: number
  settleSeconds: number
  runs: number
  busyHostProcesses: BusyProcess[]
}

export function memoryPublicationIssues(profile: MemoryPublicationProfile): string[] {
  const issues: string[] = []
  if (!profile.driverPublishable)
    issues.push('load generator is not publishable')
  if (!profile.driverVersion)
    issues.push('load generator version is unavailable')
  if (profile.platform !== 'linux')
    issues.push(`host OS is ${profile.platform}, not linux`)
  if (profile.arch !== 'x64')
    issues.push(`host architecture is ${profile.arch}, not x64`)
  if (!profile.dedicated)
    issues.push('BENCH_DEDICATED=1 is not set')
  if (profile.runtimeRequirement?.matches !== true)
    issues.push('runtime does not match package.json engines.bun')
  if (!profile.source?.revision || profile.source.dirty !== false)
    issues.push('source revision is unavailable or the working tree is not clean')
  if (profile.scenario !== 'static-json')
    issues.push(`scenario is ${profile.scenario}, not static-json`)
  if (profile.connections !== 64)
    issues.push(`connection count is ${profile.connections}, not 64`)
  if (profile.loadSeconds !== 60)
    issues.push(`load window is ${profile.loadSeconds}s, not 60s`)
  if (profile.idleSeconds !== 180)
    issues.push(`idle window is ${profile.idleSeconds}s, not 180s`)
  if (profile.sampleIntervalMs !== 100)
    issues.push(`sampling interval is ${profile.sampleIntervalMs}ms, not 100ms`)
  if (profile.settleSeconds !== 10)
    issues.push(`settled window is ${profile.settleSeconds}s, not 10s`)
  if (profile.runs < 3)
    issues.push(`only ${profile.runs} fresh-process run(s) were requested; at least 3 are required`)
  if (profile.busyHostProcesses.length > 0)
    issues.push('competing host processes were observed')
  return issues
}

export function memoryMeasurementPublicationIssues(
  targets: MemoryPublicationTarget[],
  measurements: MemoryMeasurement[],
  expectedRuns: number,
): string[] {
  const issues: string[] = []
  for (const target of targets) {
    const profileTarget = EQUAL_RATE_API_PROFILE.find(candidate => candidate.targetId === target.id)
    if (!profileTarget) {
      issues.push(`${target.id} is not in the equal-rate API memory profile`)
    }
    else if (target.requestRate !== profileTarget.requestRate) {
      issues.push(`${target.id} requested ${target.requestRate} req/s, not the profile rate of ${profileTarget.requestRate} req/s`)
    }
    if (target.skipped) {
      issues.push(`${target.id} was skipped`)
      continue
    }

    const rows = measurements.filter(row => row.targetId === target.id)
    const runs = new Set(rows.map(row => row.run))
    const hasEveryRun = runs.size === expectedRuns
      && Array.from({ length: expectedRuns }, (_, index) => index + 1).every(run => runs.has(run))
    if (rows.length !== expectedRuns || !hasEveryRun)
      issues.push(`${target.id} completed ${runs.size} of ${expectedRuns} required run(s)`)

    if (rows.some(row => !Number.isFinite(row.settledRssBytes) || row.settledRssBytes <= 0
      || !Number.isFinite(row.peakLoadRssBytes) || row.peakLoadRssBytes <= 0
      || !Number.isFinite(row.rpsMean) || row.rpsMean <= 0
      || !Number.isSafeInteger(row.requests) || row.requests <= 0
      || !Number.isSafeInteger(row.errors) || row.errors < 0))
      issues.push(`${target.id} contains an invalid measurement`)

    const errors = rows.reduce((total, row) => total + row.errors, 0)
    if (errors > 0)
      issues.push(`${target.id} recorded ${errors} request error(s)`)

    const missedRate = rows
      .filter(row => row.rpsMean / target.requestRate < MIN_MEMORY_RATE_ATTAINMENT)
      .map(row => row.run)
    if (missedRate.length > 0)
      issues.push(`${target.id} missed 98% fixed-rate attainment in run(s) ${missedRate.join(', ')}`)

    if (rows.length === expectedRuns && relativeRange(rows.map(row => row.settledRssBytes)) > MAX_STABLE_RANGE)
      issues.push(`${target.id} settled RSS exceeded the 10% stability range`)
  }
  return issues
}
