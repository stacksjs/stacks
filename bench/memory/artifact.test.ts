import type { MemoryMeasurement } from './report'
import { describe, expect, test } from 'bun:test'
import { createMemoryArtifact, MEMORY_ARTIFACT_SCHEMA_VERSION } from './artifact'
import { SCENARIOS } from '../routing/scenarios'

const measurement: MemoryMeasurement = {
  targetId: 'bun-raw',
  run: 1,
  settledRssBytes: 20_000_000,
  peakLoadRssBytes: 30_000_000,
  rpsMean: 25_000,
  requests: 1_500_000,
  errors: 0,
  requestRate: 25_000,
  rawBytes: 512,
  rawOutputFile: 'raw/bun-raw--run1.json',
}

describe('memory artifact', () => {
  test('retains schema and raw evidence links for every measurement', () => {
    const artifact = createMemoryArtifact({
      meta: {} as never,
      targets: [{ id: 'bun-raw', label: 'Bun raw', requestRate: 25_000 }],
      workload: {
        targetDefinitions: [],
        scenario: SCENARIOS[0]!,
        requests: [],
        parityChecks: [],
      },
      measurements: [measurement],
    })

    expect(MEMORY_ARTIFACT_SCHEMA_VERSION).toBe(1)
    expect(artifact.schemaVersion).toBe(1)
    expect(artifact.measurements[0]!.rawBytes).toBe(512)
    expect(artifact.measurements[0]!.rawOutputFile).toBe('raw/bun-raw--run1.json')
  })
})
