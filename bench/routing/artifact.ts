import type { RoutingParityCheck } from './publication'
import type { Measurement, RoutingRepeat, RunMeta } from './report'
import type { Scenario } from './scenarios'
import type { Target } from './targets'

export const ROUTING_ARTIFACT_SCHEMA_VERSION = 4

export interface RoutingArtifactRequest {
  body?: string
  headers: Record<string, string>
  method: string
  path: string
  scenarioId: string
  targetId: string
}

export interface RoutingArtifact {
  measurements: Measurement[]
  meta: RunMeta
  repeats: RoutingRepeat[]
  schemaVersion: typeof ROUTING_ARTIFACT_SCHEMA_VERSION
  targets: Array<{ id: string, label: string, skipped?: string }>
  workload: {
    parityChecks: RoutingParityCheck[]
    requests: RoutingArtifactRequest[]
    scenarios: Scenario[]
    targetDefinitions: Target[]
  }
}

export function createRoutingArtifact(input: Omit<RoutingArtifact, 'schemaVersion'>): RoutingArtifact {
  return { schemaVersion: ROUTING_ARTIFACT_SCHEMA_VERSION, ...input }
}
