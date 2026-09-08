import type { BusyProcess } from './host-load'
import type { Measurement, RoutingRepeat } from './report'
import type { RuntimeRequirement } from './runtime-version'
import type { ScenarioParityEvidence } from './runtime'
import type { SourceState } from './source'
import { selectedPeerPackages } from './peer-versions'
import { STACKS_RUNTIME_PACKAGES } from './provenance'
import { isValidParityEvidence } from './runtime'
import { SCENARIOS } from './scenarios'
import { MAX_STABLE_RANGE } from './statistics'
import { DEFAULT_TARGETS } from './targets'

export interface RoutingPublicationTarget {
  id: string
  skipped?: string
}

export interface RoutingPublicationScenario {
  id: string
  probes?: readonly { id: string }[]
}

export interface RoutingParityCheck {
  targetId: string
  scenarioId: string
  run: number
  before: ScenarioParityEvidence
  after: ScenarioParityEvidence
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
  stacksRuntimeDependencies: Record<string, { version: string, path: string }>
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
  if (profile.targetIds.some(id => id.startsWith('stacks'))) {
    const unavailableDependencies = STACKS_RUNTIME_PACKAGES.filter((packageName) => {
      const dependency = profile.stacksRuntimeDependencies[packageName]
      return !dependency || dependency.version === 'unavailable' || dependency.path === 'unavailable'
    })
    if (unavailableDependencies.length > 0)
      issues.push(`Stacks runtime dependency is unavailable for ${unavailableDependencies.join(', ')}`)
  }
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
  parityChecks: RoutingParityCheck[],
  repeats: RoutingRepeat[] = [],
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
        || !Object.values(row.latencyMs).every(value => value == null || (Number.isFinite(value) && value >= 0))
        || (row.errorRate != null && (!Number.isFinite(row.errorRate) || row.errorRate < 0 || row.errorRate > 1))
        || (row.rangeRatio != null && (!Number.isFinite(row.rangeRatio) || row.rangeRatio < 0)))
        issues.push(`${key} contains an invalid measurement`)
      // Distinguished from "no errors". A row with no requests has no error
      // rate to report, and reading that as 0% is how a wholly failed run
      // passed the gate.
      if (row.errorRate == null)
        issues.push(`${key} recorded no requests, so it has no error rate`)
      else if (row.errorRate > 0)
        issues.push(`${key} recorded request errors`)
      if (Object.values(row.latencyMs).some(value => value == null))
        issues.push(`${key} is missing a latency percentile`)
      if (row.cpuPercent == null || !Number.isFinite(row.cpuPercent) || row.cpuPercent < 0)
        issues.push(`${key} has no valid server CPU reading`)
      if (measurementRange(row) > MAX_STABLE_RANGE)
        issues.push(`${key} exceeded the 10% throughput stability range`)

      /*
       * Every repeat, not just the aggregate.
       *
       * A median hides an individual invalid latency, and a repeat that served
       * no requests used to contribute a zero error rate to the mean. The run
       * ordinal is named so the raw output for the offending repeat can be
       * found on disk (stacksjs/stacks#2470).
       */
      const runs = repeats.filter(r => r.targetId === target.id && r.scenarioId === scenario.id)
      if (repeats.length > 0) {
        // Same completeness predicate the parity checks below already use:
        // the right count, no duplicates, and every ordinal in range.
        const completeRepeats = runs.length === expectedRuns
          && new Set(runs.map(r => r.run)).size === expectedRuns
          && runs.every(r => Number.isSafeInteger(r.run) && r.run >= 1 && r.run <= expectedRuns)
        if (!completeRepeats) {
          issues.push(`${key} did not retain ${expectedRuns} identified repeat(s)`)
        }
        else {
          for (const repeat of runs) {
            const at = `${key} run ${repeat.run}`
            if (!Number.isFinite(repeat.rpsMean) || repeat.rpsMean <= 0)
              issues.push(`${at} has an invalid throughput measurement`)
            if (Object.values(repeat.latencyMs).some(value => value == null || !Number.isFinite(value) || value < 0))
              issues.push(`${at} is missing a latency percentile`)
            if (repeat.cpuPercent == null || !Number.isFinite(repeat.cpuPercent) || repeat.cpuPercent < 0)
              issues.push(`${at} has no valid server CPU reading`)
            if (!Number.isSafeInteger(repeat.requests) || repeat.requests <= 0)
              issues.push(`${at} recorded no requests`)
            if (!Number.isSafeInteger(repeat.errors) || repeat.errors < 0 || repeat.errors > repeat.requests)
              issues.push(`${at} has an invalid error count`)
            // Raw output is the only way to audit a disputed repeat, and an
            // empty capture means there is nothing to audit.
            if (!Number.isSafeInteger(repeat.rawBytes) || repeat.rawBytes <= 0)
              issues.push(`${at} preserved no raw output`)
          }
        }
      }

      const checks = parityChecks.filter(check => check.targetId === target.id && check.scenarioId === scenario.id)
      const completeRuns = checks.length === expectedRuns
        && new Set(checks.map(check => check.run)).size === expectedRuns
        && checks.every(check => Number.isSafeInteger(check.run) && check.run >= 1 && check.run <= expectedRuns)
      if (!completeRuns) {
        issues.push(`${key} did not retain ${expectedRuns} required parity check(s)`)
        continue
      }

      const expectedProbeIds = scenario.probes?.map(probe => probe.id) ?? []
      const validEvidence = checks.every(check => [check.before, check.after]
        .every(evidence => isValidParityEvidence(evidence, expectedProbeIds)))
      if (!validEvidence)
        issues.push(`${key} contains invalid parity evidence`)
      if (checks.some(check => JSON.stringify(check.before) !== JSON.stringify(check.after)))
        issues.push(`${key} changed parity evidence under load`)
    }
  }
  return issues
}
