import type { RoutingArtifact } from './artifact'
import type { Measurement, RoutingRepeat, RunMeta } from './report'
import { afterEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRoutingArtifact } from './artifact'
import { summarizeRoutingMeasurements } from './aggregate'
import { renderReport } from './report'
import { SCENARIOS } from './scenarios'
import { verifyRoutingArtifactDirectory } from './verify-artifact'

const roots: string[] = []

const measuredRaw = JSON.stringify({
  summary: { requestsPerSec: 10_000 },
  rps: { percentiles: { p50: 10_000 } },
  latencyPercentiles: { p50: 0.001, p90: 0.002, p99: 0.003 },
  statusCodeDistribution: { 200: 300_000 },
})
const warmupRaw = JSON.stringify({
  summary: { requestsPerSec: 10_000 },
  statusCodeDistribution: { 200: 50_000 },
})

const meta: RunMeta = {
  startedAt: '2026-09-21T00:00:00.000Z',
  driver: 'oha',
  driverVersion: 'oha 1.16.0',
  loadTopology: 'same-host',
  publishable: false,
  connections: 50,
  requestRate: 10_000,
  warmupSeconds: 5,
  durationSeconds: 30,
  runs: 1,
  persistentQueryLogging: false,
  machine: { arch: 'x64', platform: 'linux', release: 'test', cpu: 'test', cores: 4, bun: '1.4.2', clockTicksPerSecond: 100 },
}

const measurement: Measurement = {
  targetId: 'bun-raw',
  scenarioId: 'static-json',
  rpsMean: 10_000,
  rpsP50: 10_000,
  latencyMs: { p50: 1, p90: 2, p99: 3 },
  errorRate: 0,
  cpuPercent: 20,
  cpuMicrosPerRequest: 20,
  rateAttained: 1,
  spread: { min: 10_000, max: 10_000 },
  runs: 1,
}

const repeat: RoutingRepeat = {
  targetId: 'bun-raw',
  scenarioId: 'static-json',
  run: 1,
  rpsMean: 10_000,
  rpsP50: 10_000,
  latencyMs: { p50: 1, p90: 2, p99: 3 },
  requests: 300_000,
  errors: 0,
  cpuPercent: 20,
  cpuSource: 'proc',
  cpuMicrosPerRequest: 20,
  rateAttained: 1,
  rawBytes: Buffer.byteLength(measuredRaw),
  rawOutputFile: 'raw/bun-raw--static-json--run1.txt',
  warmupOutputFile: 'raw/bun-raw--static-json--run1--warmup.txt',
}

function artifact(): RoutingArtifact {
  const value = createRoutingArtifact({
    meta,
    targets: [{ id: 'bun-raw', label: 'Bun.serve baseline' }],
    workload: {
      targetDefinitions: [{ id: 'bun-raw', label: 'Bun.serve baseline', server: 'bun-raw.ts' }],
      scenarios: [SCENARIOS[0]!],
      requests: [{ targetId: 'bun-raw', scenarioId: 'static-json', method: 'GET', path: '/bench/json', headers: {} }],
      parityChecks: [],
    },
    measurements: [measurement],
    repeats: [{ ...repeat }],
  })
  value.measurements = summarizeRoutingMeasurements(value.repeats, ['bun-raw'], ['static-json'], 1, true)
  return value
}

function writeArtifact(over?: (value: RoutingArtifact, root: string) => void): string {
  const root = mkdtempSync(join(tmpdir(), 'routing-artifact-'))
  roots.push(root)
  mkdirSync(join(root, 'raw'))
  const value = artifact()
  writeFileSync(join(root, repeat.rawOutputFile), measuredRaw)
  writeFileSync(join(root, repeat.warmupOutputFile!), warmupRaw)
  over?.(value, root)
  writeFileSync(join(root, 'measurements.json'), `${JSON.stringify(value, null, 2)}\n`)
  writeFileSync(join(root, 'report.md'), renderReport({
    meta: value.meta,
    scenarios: value.workload.scenarios,
    targets: value.targets,
    measurements: value.measurements,
    repeats: value.repeats,
  }))
  return root
}

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

describe('routing artifact verifier', () => {
  test('verifies raw files, byte counts, CPU provenance, and report reproduction', () => {
    expect(verifyRoutingArtifactDirectory(writeArtifact())).toEqual({
      cpuSources: ['proc'],
      rawFileCount: 2,
      repeatCount: 1,
    })
  })

  test('rejects unsupported schemas and duplicate repeat identities', () => {
    const schema = writeArtifact(value => Object.assign(value, { schemaVersion: 3 }))
    expect(() => verifyRoutingArtifactDirectory(schema)).toThrow('unsupported schema version 3')

    const duplicate = writeArtifact(value => value.repeats.push({ ...value.repeats[0]! }))
    expect(() => verifyRoutingArtifactDirectory(duplicate)).toThrow('duplicate repeat identity')
  })

  test('rejects unsafe and non-deterministic output paths', () => {
    const traversal = writeArtifact(value => value.repeats[0]!.rawOutputFile = '../raw.txt')
    expect(() => verifyRoutingArtifactDirectory(traversal)).toThrow('not a safe artifact-relative path')

    const wrong = writeArtifact(value => value.repeats[0]!.rawOutputFile = 'raw/wrong.txt')
    expect(() => verifyRoutingArtifactDirectory(wrong)).toThrow('not deterministic')
  })

  test('rejects missing, non-file, empty, and size-mismatched raw evidence', () => {
    const missing = writeArtifact((_, root) => rmSync(join(root, repeat.rawOutputFile)))
    expect(() => verifyRoutingArtifactDirectory(missing)).toThrow('file is missing')

    const directory = writeArtifact((_, root) => {
      rmSync(join(root, repeat.rawOutputFile))
      mkdirSync(join(root, repeat.rawOutputFile))
    })
    expect(() => verifyRoutingArtifactDirectory(directory)).toThrow('not a regular file')

    const empty = writeArtifact((_, root) => writeFileSync(join(root, repeat.rawOutputFile), ''))
    expect(() => verifyRoutingArtifactDirectory(empty)).toThrow('file is empty')

    const mismatched = writeArtifact(value => value.repeats[0]!.rawBytes++)
    expect(() => verifyRoutingArtifactDirectory(mismatched)).toThrow('but its file has')
  })

  test('rejects a report that does not reproduce from structured evidence', () => {
    const root = writeArtifact()
    writeFileSync(join(root, 'report.md'), 'stale report\n')
    expect(() => verifyRoutingArtifactDirectory(root)).toThrow('does not match its structured evidence')
  })

  test('rejects aggregate measurements that drift from retained repeats', () => {
    const root = writeArtifact(value => value.measurements[0]!.rpsMean++)
    expect(() => verifyRoutingArtifactDirectory(root)).toThrow('measurements do not match retained repeats')
  })

  test('rejects repeat metrics that drift from raw oha evidence', () => {
    const root = writeArtifact(value => value.repeats[0]!.requests--)
    expect(() => verifyRoutingArtifactDirectory(root)).toThrow('does not match its raw oha evidence')
  })

  test('rejects malformed measured output and failed warm-up evidence', () => {
    const malformed = writeArtifact((value, root) => {
      const raw = '{not-json}'
      writeFileSync(join(root, repeat.rawOutputFile), raw)
      value.repeats[0]!.rawBytes = Buffer.byteLength(raw)
    })
    expect(() => verifyRoutingArtifactDirectory(malformed)).toThrow()

    const failedWarmup = writeArtifact((_, root) => writeFileSync(join(root, repeat.warmupOutputFile!), JSON.stringify({
      summary: { requestsPerSec: 10 },
      statusCodeDistribution: { 500: 50 },
    })))
    expect(() => verifyRoutingArtifactDirectory(failedWarmup)).toThrow('failed warm-up evidence')
  })
})
