import type { BusyProcess } from './host-load'
import type { Measurement } from './report'
import type { RuntimeRequirement } from './runtime-version'
import type { SourceState } from './source'
import { selectedPeerPackages } from './peer-versions'
import { SCENARIOS } from './scenarios'
import { MAX_STABLE_RANGE } from './statistics'
import { DEFAULT_TARGETS } from './targets'

export interface RoutingPublicationTarget {
  id: string
  skipped?: string
}

export interface RoutingPublicationScenario {
  id: string
}

export interface RoutingPublicationProfile {
  driverPublishable: boolean
  driverVersion: string | null
  dedicated: boolean
  runtimeRequirement?: RuntimeRequirement
  source?: SourceState
  targetIds: string[]
  scenarioIds: string[]
  peerVersions: Record<string, string>
  warmupSeconds: number
  durationSeconds: number
  runs: number
  busyHostProcesses: BusyProcess[]
}

export function routingPublicationIssues(profile: RoutingPublicationProfile): string[] {
  const issues: string[] = []
  if (!profile.driverPublishable)
    issues.push('load generator is not publishable')
  if (!profile.driverVersion)
    issues.push('load generator version is unavailable')
  if (!profile.dedicated)
    issues.push('BENCH_DEDICATED=1 is not set')
  if (profile.runtimeRequirement?.matches !== true)
    issues.push('runtime does not match package.json engines.bun')
  if (!profile.source?.revision || profile.source.dirty !== false)
    issues.push('source revision is unavailable or the working tree is not clean')
  const selectedTargetIds = new Set(profile.targetIds)
  const missingTargets = DEFAULT_TARGETS.map(target => target.id).filter(id => !selectedTargetIds.has(id))
  if (missingTargets.length > 0)
    issues.push(`target set omits default targets: ${missingTargets.join(', ')}`)
  if (selectedTargetIds.size !== profile.targetIds.length)
    issues.push('target set contains duplicate targets')
  const expectedScenarioIds = SCENARIOS.map(scenario => scenario.id)
  if (profile.scenarioIds.length !== expectedScenarioIds.length
    || new Set(profile.scenarioIds).size !== expectedScenarioIds.length
    || expectedScenarioIds.some(id => !profile.scenarioIds.includes(id)))
    issues.push('scenario set does not match the full routing matrix')
  const unidentifiedPeers = selectedPeerPackages(profile.targetIds)
    .filter(packageName => !profile.peerVersions[packageName] || profile.peerVersions[packageName] === 'unavailable')
  if (unidentifiedPeers.length > 0)
    issues.push(`peer framework version is unavailable for ${unidentifiedPeers.join(', ')}`)
  if (profile.warmupSeconds < 5)
    issues.push(`warm-up is ${profile.warmupSeconds}s; at least 5s is required`)
  if (profile.durationSeconds < 30)
    issues.push(`measurement window is ${profile.durationSeconds}s; at least 30s is required`)
  if (profile.runs < 3)
    issues.push(`only ${profile.runs} run(s) were requested; at least 3 are required`)
  if (profile.busyHostProcesses.length > 0)
    issues.push('competing host processes were observed')
  return issues
}

function measurementRange(measurement: Measurement): number {
  return measurement.rangeRatio
    ?? (measurement.spread.max - measurement.spread.min) / measurement.rpsMean
}

export function routingMeasurementPublicationIssues(
  targets: RoutingPublicationTarget[],
  scenarios: readonly RoutingPublicationScenario[],
  measurements: Measurement[],
  expectedRuns: number,
): string[] {
  const issues: string[] = []
  for (const target of targets) {
    if (target.skipped) {
      issues.push(`${target.id} was skipped`)
      continue
    }

    for (const scenario of scenarios) {
      const rows = measurements.filter(row => row.targetId === target.id && row.scenarioId === scenario.id)
      const key = `${target.id}:${scenario.id}`
      if (rows.length !== 1 || rows[0]?.runs !== expectedRuns) {
        issues.push(`${key} did not complete ${expectedRuns} required run(s)`)
        continue
      }

      const row = rows[0]
      if (!Number.isFinite(row.rpsMean) || row.rpsMean <= 0
        || (row.rpsP50 != null && (!Number.isFinite(row.rpsP50) || row.rpsP50 < 0))
        || !Number.isFinite(row.spread.min) || row.spread.min <= 0
        || !Number.isFinite(row.spread.max) || row.spread.max < row.spread.min
        || !Object.values(row.latencyMs).every(value => Number.isFinite(value) && value >= 0)
        || !Number.isFinite(row.errorRate) || row.errorRate < 0 || row.errorRate > 1
        || (row.rangeRatio != null && (!Number.isFinite(row.rangeRatio) || row.rangeRatio < 0)))
        issues.push(`${key} contains an invalid measurement`)
      if (row.errorRate > 0)
        issues.push(`${key} recorded request errors`)
      if (row.cpuPercent == null || !Number.isFinite(row.cpuPercent) || row.cpuPercent < 0)
        issues.push(`${key} has no valid server CPU reading`)
      if (measurementRange(row) > MAX_STABLE_RANGE)
        issues.push(`${key} exceeded the 10% throughput stability range`)
    }
  }
  return issues
}
