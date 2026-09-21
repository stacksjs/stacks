import type { RoutingRepeat } from './report'
import { describe, expect, test } from 'bun:test'
import { createRoutingArtifact, ROUTING_ARTIFACT_SCHEMA_VERSION } from './artifact'

const repeat: RoutingRepeat = {
  targetId: 'stacks',
  scenarioId: 'static-json',
  run: 1,
  rpsMean: 10_000,
  rpsP50: 10_000,
  latencyMs: { p50: 0.2, p90: 0.3, p99: 0.5 },
  requests: 300_000,
  errors: 0,
  cpuPercent: 25,
  cpuSource: 'proc',
  cpuMicrosPerRequest: 25,
  rateAttained: 1,
  rawBytes: 512,
  rawOutputFile: 'raw/stacks--static-json--run1.txt',
  warmupOutputFile: 'raw/stacks--static-json--run1--warmup.txt',
}

describe('routing artifact', () => {
  test('retains auditable repeat evidence under schema v4', () => {
    const artifact = createRoutingArtifact({
      meta: {} as never,
      targets: [{ id: 'stacks', label: 'Stacks' }],
      workload: {
        targetDefinitions: [] as never,
        scenarios: [] as never,
        requests: [],
        parityChecks: [],
      },
      measurements: [],
      repeats: [repeat],
    })

    expect(ROUTING_ARTIFACT_SCHEMA_VERSION).toBe(4)
    expect(artifact.schemaVersion).toBe(4)
    expect(artifact.repeats).toEqual([repeat])
    expect(artifact.repeats[0]!.cpuSource).toBe('proc')
    expect(artifact.repeats[0]!.rawOutputFile).toBe('raw/stacks--static-json--run1.txt')
  })
})
