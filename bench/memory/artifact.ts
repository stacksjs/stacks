import type { ScenarioParityEvidence } from '../routing/runtime'
import type { Scenario } from '../routing/scenarios'
import type { Target } from '../routing/targets'
import type { MemoryMeasurement, MemoryRunMeta } from './report'

export const MEMORY_ARTIFACT_SCHEMA_VERSION = 1

export interface MemoryArtifactRequest {
  body?: string
  headers: Record<string, string>
  method: string
  path: string
  scenarioId: string
  targetId: string
}

export interface MemoryArtifact {
  measurements: MemoryMeasurement[]
  meta: MemoryRunMeta
  schemaVersion: typeof MEMORY_ARTIFACT_SCHEMA_VERSION
  targets: Array<{ id: string, label: string, requestRate: number, skipped?: string }>
  workload: {
    parityChecks: Array<{
      after: ScenarioParityEvidence
      before: ScenarioParityEvidence
      run: number
      targetId: string
    }>
    requests: MemoryArtifactRequest[]
    scenario: Scenario
    targetDefinitions: Array<{
      label: string
      requestRate: number
      target: Target
      targetId: string
    }>
  }
}

export function createMemoryArtifact(input: Omit<MemoryArtifact, 'schemaVersion'>): MemoryArtifact {
  return { schemaVersion: MEMORY_ARTIFACT_SCHEMA_VERSION, ...input }
}
