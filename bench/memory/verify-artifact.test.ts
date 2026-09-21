import type { MemoryArtifact, MemoryRawRun } from './artifact'
import type { MemoryMeasurement, MemoryRunMeta } from './report'
import { afterEach, describe, expect, test } from 'bun:test'
import { Buffer } from 'node:buffer'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SCENARIOS } from '../routing/scenarios'
import { createMemoryArtifact } from './artifact'
import { renderMemoryReport } from './report'
import { verifyMemoryArtifactDirectory } from './verify-artifact'

const roots: string[] = []

const meta: MemoryRunMeta = {
  startedAt: '2026-09-21T00:00:00.000Z',
  driver: 'oha',
  driverVersion: 'oha 1.16.0',
  loadTopology: 'same-host',
  publishable: false,
  scenario: 'static-json',
  connections: 64,
  loadSeconds: 1,
  idleSeconds: 1,
  sampleIntervalMs: 100,
  settleSeconds: 1,
  runs: 1,
  machine: { arch: 'x64', platform: 'linux', release: 'test', cpu: 'test', cores: 4, bun: '1.4.2' },
}

function fixture(): { artifact: MemoryArtifact, raw: MemoryRawRun } {
  const response = { status: 200, mediaType: 'application/json', bodyBytes: 17, bodySha256: 'a'.repeat(64) }
  const parity = {
    before: { primary: { ...response }, probes: [] },
    after: { primary: { ...response }, probes: [] },
  }
  const measurement: MemoryMeasurement = {
    targetId: 'bun-raw',
    run: 1,
    settledRssBytes: 101,
    peakLoadRssBytes: 120,
    rpsMean: 1_000,
    requests: 1_000,
    errors: 0,
    requestRate: 1_000,
    rawBytes: 1,
    rawOutputFile: 'raw/bun-raw--run1.json',
  }
  const raw: MemoryRawRun = {
    targetId: 'bun-raw',
    run: 1,
    settledAfterMs: 1_000,
    samples: [
      { elapsedMs: 100, phase: 'load', rssBytes: 120 },
      { elapsedMs: 1_000, phase: 'idle', rssBytes: 100 },
      { elapsedMs: 1_100, phase: 'idle', rssBytes: 102 },
    ],
    load: {
      rpsMean: 1_000,
      rpsP50: 1_000,
      latencyMs: { p50: 1, p90: 2, p99: 3 },
      requests: 1_000,
      errors: 0,
      raw: 'load output',
    },
    parity,
  }
  const artifact = createMemoryArtifact({
    meta,
    targets: [{ id: 'bun-raw', label: 'Bun.serve baseline', requestRate: 1_000 }],
    workload: {
      targetDefinitions: [{
        targetId: 'bun-raw', label: 'Bun.serve baseline', requestRate: 1_000,
        target: { id: 'bun-raw', label: 'Bun.serve baseline', server: 'bun-raw.ts' },
      }],
      scenario: SCENARIOS[0]!,
      requests: [{ targetId: 'bun-raw', scenarioId: 'static-json', method: 'GET', path: '/bench/json', headers: {} }],
      parityChecks: [{
        targetId: 'bun-raw',
        run: 1,
        before: structuredClone(parity.before),
        after: structuredClone(parity.after),
      }],
    },
    measurements: [measurement],
  })
  return { artifact, raw }
}

function persistStructured(root: string, artifact: MemoryArtifact): void {
  writeFileSync(join(root, 'measurements.json'), `${JSON.stringify(artifact, null, 2)}\n`)
  writeFileSync(join(root, 'report.md'), renderMemoryReport({
    meta: artifact.meta,
    targets: artifact.targets,
    measurements: artifact.measurements,
  }))
}

function persistRaw(root: string, artifact: MemoryArtifact, raw: MemoryRawRun, updateBytes = true): void {
  const output = `${JSON.stringify(raw, null, 2)}\n`
  writeFileSync(join(root, 'raw/bun-raw--run1.json'), output)
  if (updateBytes) artifact.measurements[0]!.rawBytes = Buffer.byteLength(output)
  persistStructured(root, artifact)
}

function writeArtifact(): { artifact: MemoryArtifact, raw: MemoryRawRun, root: string } {
  const root = mkdtempSync(join(tmpdir(), 'memory-artifact-'))
  roots.push(root)
  mkdirSync(join(root, 'raw'))
  const { artifact, raw } = fixture()
  persistRaw(root, artifact, raw)
  return { artifact, raw, root }
}

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

describe('memory artifact verifier', () => {
  test('reconstructs RSS, load, and parity evidence from the raw run', () => {
    expect(verifyMemoryArtifactDirectory(writeArtifact().root)).toEqual({
      measurementCount: 1,
      rawFileCount: 1,
      sampleCount: 3,
    })
  })

  test('rejects unsupported schemas and duplicate identities', () => {
    const schema = writeArtifact()
    Object.assign(schema.artifact, { schemaVersion: 0 })
    persistStructured(schema.root, schema.artifact)
    expect(() => verifyMemoryArtifactDirectory(schema.root)).toThrow('unsupported schema version 0')

    const duplicate = writeArtifact()
    duplicate.artifact.measurements.push({ ...duplicate.artifact.measurements[0]! })
    persistStructured(duplicate.root, duplicate.artifact)
    expect(() => verifyMemoryArtifactDirectory(duplicate.root)).toThrow('duplicate measurement identity')
  })

  test('rejects unsafe paths and missing, non-file, empty, or size-mismatched raw evidence', () => {
    const unsafe = writeArtifact()
    unsafe.artifact.measurements[0]!.rawOutputFile = '../raw.json'
    persistStructured(unsafe.root, unsafe.artifact)
    expect(() => verifyMemoryArtifactDirectory(unsafe.root)).toThrow('not a safe artifact-relative path')

    const missing = writeArtifact()
    rmSync(join(missing.root, 'raw/bun-raw--run1.json'))
    expect(() => verifyMemoryArtifactDirectory(missing.root)).toThrow('file is missing')

    const directory = writeArtifact()
    rmSync(join(directory.root, 'raw/bun-raw--run1.json'))
    mkdirSync(join(directory.root, 'raw/bun-raw--run1.json'))
    expect(() => verifyMemoryArtifactDirectory(directory.root)).toThrow('not a regular file')

    const empty = writeArtifact()
    writeFileSync(join(empty.root, 'raw/bun-raw--run1.json'), '')
    expect(() => verifyMemoryArtifactDirectory(empty.root)).toThrow('file is empty')

    const size = writeArtifact()
    size.artifact.measurements[0]!.rawBytes++
    persistStructured(size.root, size.artifact)
    expect(() => verifyMemoryArtifactDirectory(size.root)).toThrow('but its file has')
  })

  test('rejects raw identity, RSS, load, and parity drift', () => {
    const identity = writeArtifact()
    identity.raw.run = 2
    persistRaw(identity.root, identity.artifact, identity.raw)
    expect(() => verifyMemoryArtifactDirectory(identity.root)).toThrow('raw identity does not match')

    const rss = writeArtifact()
    rss.raw.samples[0]!.rssBytes = 121
    persistRaw(rss.root, rss.artifact, rss.raw)
    expect(() => verifyMemoryArtifactDirectory(rss.root)).toThrow('RSS summary does not match')

    const load = writeArtifact()
    load.raw.load.requests = 999
    persistRaw(load.root, load.artifact, load.raw)
    expect(() => verifyMemoryArtifactDirectory(load.root)).toThrow('load summary does not match')

    const parityDrift = writeArtifact()
    parityDrift.raw.parity.after.primary.bodySha256 = 'b'.repeat(64)
    persistRaw(parityDrift.root, parityDrift.artifact, parityDrift.raw)
    expect(() => verifyMemoryArtifactDirectory(parityDrift.root)).toThrow('parity evidence does not match')
  })

  test('rejects a report that does not reproduce from structured evidence', () => {
    const value = writeArtifact()
    writeFileSync(join(value.root, 'report.md'), 'stale report\n')
    expect(() => verifyMemoryArtifactDirectory(value.root)).toThrow('does not match its structured evidence')
  })
})
