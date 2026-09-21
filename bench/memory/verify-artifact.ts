import type { MemoryArtifact, MemoryRawRun } from './artifact'
import type { MemoryMeasurement, MemorySample } from './report'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { artifactRelativeFile, regularArtifactFileSize } from '../artifact-files'
import { isValidParityEvidence } from '../routing/runtime'
import { MEMORY_ARTIFACT_SCHEMA_VERSION } from './artifact'
import { median, renderMemoryReport } from './report'

export interface MemoryArtifactVerification {
  measurementCount: number
  rawFileCount: number
  sampleCount: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function validSamples(value: unknown): value is MemorySample[] {
  return Array.isArray(value) && value.length > 0 && value.every((sample, index) =>
    isRecord(sample)
    && (sample.phase === 'load' || sample.phase === 'idle')
    && Number.isFinite(sample.elapsedMs)
    && (sample.elapsedMs as number) >= 0
    && Number.isFinite(sample.rssBytes)
    && (sample.rssBytes as number) > 0
    && (index === 0 || (sample.elapsedMs as number) >= (value[index - 1] as MemorySample).elapsedMs))
}

function validateRawSummary(measurement: MemoryMeasurement, raw: MemoryRawRun): number {
  const identity = `${measurement.targetId} run ${measurement.run}`
  if (raw.targetId !== measurement.targetId || raw.run !== measurement.run)
    throw new Error(`Memory artifact ${identity} raw identity does not match its measurement`)
  if (!validSamples(raw.samples))
    throw new Error(`Memory artifact ${identity} contains invalid RSS samples`)
  if (!Number.isFinite(raw.settledAfterMs) || raw.settledAfterMs < 0)
    throw new Error(`Memory artifact ${identity} has an invalid settled-window boundary`)

  const loadSamples = raw.samples.filter(sample => sample.phase === 'load')
  const settledSamples = raw.samples.filter(sample => sample.phase === 'idle' && sample.elapsedMs >= raw.settledAfterMs)
  if (loadSamples.length === 0 || settledSamples.length === 0)
    throw new Error(`Memory artifact ${identity} cannot reconstruct its load and settled windows`)
  if (Math.max(...loadSamples.map(sample => sample.rssBytes)) !== measurement.peakLoadRssBytes
    || median(settledSamples.map(sample => sample.rssBytes)) !== measurement.settledRssBytes)
    throw new Error(`Memory artifact ${identity} RSS summary does not match its raw samples`)
  if (!isRecord(raw.load)
    || raw.load.rpsMean !== measurement.rpsMean
    || raw.load.requests !== measurement.requests
    || raw.load.errors !== measurement.errors)
    throw new Error(`Memory artifact ${identity} load summary does not match its raw output`)
  return raw.samples.length
}

export function verifyMemoryArtifactDirectory(directory: string): MemoryArtifactVerification {
  const root = resolve(directory)
  const parsed: unknown = JSON.parse(readFileSync(resolve(root, 'measurements.json'), 'utf8'))
  if (!isRecord(parsed) || parsed.schemaVersion !== MEMORY_ARTIFACT_SCHEMA_VERSION)
    throw new Error(`Memory artifact uses unsupported schema version ${isRecord(parsed) ? String(parsed.schemaVersion) : 'unknown'}`)
  if (!isRecord(parsed.workload) || !isRecord(parsed.workload.scenario))
    throw new Error('Memory artifact has no workload definition')
  if (!Array.isArray(parsed.targets) || parsed.targets.length === 0 || !Array.isArray(parsed.measurements) || parsed.measurements.length === 0)
    throw new Error('Memory artifact has no targets or measurements')
  if (!Array.isArray(parsed.workload.parityChecks))
    throw new Error('Memory artifact has no parity evidence')

  const targetIds = parsed.targets.map((value) => {
    if (!isRecord(value) || typeof value.id !== 'string' || !/^[a-z\d][a-z\d-]*$/.test(value.id))
      throw new Error('Memory artifact contains an invalid target ID')
    return value.id
  })
  if (new Set(targetIds).size !== targetIds.length)
    throw new Error('Memory artifact contains duplicate target IDs')

  const artifact = parsed as unknown as MemoryArtifact
  const identities = new Set<string>()
  const probeIds = Array.isArray(artifact.workload.scenario.probes)
    ? artifact.workload.scenario.probes.map(probe => probe.id)
    : []
  let sampleCount = 0
  for (const measurement of artifact.measurements) {
    if (!isRecord(measurement)
      || typeof measurement.targetId !== 'string'
      || !targetIds.includes(measurement.targetId)
      || !Number.isSafeInteger(measurement.run)
      || measurement.run < 1)
      throw new Error('Memory artifact contains a malformed measurement identity')
    const identity = `${measurement.targetId}:${measurement.run}`
    if (identities.has(identity))
      throw new Error(`Memory artifact contains duplicate measurement identity ${identity}`)
    identities.add(identity)
    if (!Number.isSafeInteger(measurement.rawBytes) || measurement.rawBytes <= 0)
      throw new Error(`Memory artifact ${identity} has an invalid raw byte count`)

    const rawPath = `raw/${measurement.targetId}--run${measurement.run}.json`
    const rawFile = artifactRelativeFile(root, measurement.rawOutputFile, rawPath, 'Memory artifact raw output')
    const rawSize = regularArtifactFileSize(rawFile, 'Memory artifact raw output')
    if (rawSize !== measurement.rawBytes)
      throw new Error(`Memory artifact ${identity} raw byte count is ${measurement.rawBytes}, but its file has ${rawSize}`)
    const raw = JSON.parse(readFileSync(rawFile, 'utf8')) as MemoryRawRun
    sampleCount += validateRawSummary(measurement, raw)

    const parity = artifact.workload.parityChecks.filter(check => check.targetId === measurement.targetId && check.run === measurement.run)
    if (parity.length !== 1 || !isRecord(raw.parity) || !same(raw.parity, { before: parity[0]!.before, after: parity[0]!.after }))
      throw new Error(`Memory artifact ${identity} parity evidence does not match its raw output`)
    if (!isValidParityEvidence(parity[0]!.before, probeIds)
      || !isValidParityEvidence(parity[0]!.after, probeIds)
      || !same(parity[0]!.before, parity[0]!.after))
      throw new Error(`Memory artifact ${identity} contains invalid or changing parity evidence`)
  }
  if (artifact.workload.parityChecks.length !== identities.size)
    throw new Error('Memory artifact contains unmatched parity evidence')

  const regenerated = renderMemoryReport({ meta: artifact.meta, targets: artifact.targets, measurements: artifact.measurements })
  if (readFileSync(resolve(root, 'report.md'), 'utf8') !== regenerated)
    throw new Error('Memory artifact report.md does not match its structured evidence')

  return { measurementCount: artifact.measurements.length, rawFileCount: artifact.measurements.length, sampleCount }
}

function parseDirectory(args: readonly string[]): string {
  if (args.length !== 1 || !args[0]!.startsWith('--directory=') || args[0]!.length === '--directory='.length)
    throw new Error('Usage: bun bench/memory/verify-artifact.ts --directory=<artifact-directory>')
  return args[0]!.slice('--directory='.length)
}

if (import.meta.main) {
  const result = verifyMemoryArtifactDirectory(parseDirectory(process.argv.slice(2)))
  console.log(`Verified ${result.measurementCount} memory measurement(s), ${result.rawFileCount} raw file(s), ${result.sampleCount} RSS sample(s)`)
}
