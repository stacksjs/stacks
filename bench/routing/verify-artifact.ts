import type { RoutingArtifact } from './artifact'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { artifactRelativeFile, regularArtifactFileSize } from '../artifact-files'
import { ROUTING_ARTIFACT_SCHEMA_VERSION } from './artifact'
import { renderReport } from './report'

export interface RoutingArtifactVerification {
  cpuSources: string[]
  rawFileCount: number
  repeatCount: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function recordIds(rows: unknown, kind: string): Set<string> {
  if (!Array.isArray(rows) || rows.length === 0)
    throw new Error(`Routing artifact has no ${kind}`)
  const ids = rows.map((row) => {
    if (!isRecord(row) || typeof row.id !== 'string' || !/^[a-z\d][a-z\d-]*$/.test(row.id))
      throw new Error(`Routing artifact contains an invalid ${kind} ID`)
    return row.id
  })
  if (new Set(ids).size !== ids.length)
    throw new Error(`Routing artifact contains duplicate ${kind} IDs`)
  return new Set(ids)
}

export function verifyRoutingArtifactDirectory(directory: string): RoutingArtifactVerification {
  const root = resolve(directory)
  const parsed: unknown = JSON.parse(readFileSync(resolve(root, 'measurements.json'), 'utf8'))
  if (!isRecord(parsed) || parsed.schemaVersion !== ROUTING_ARTIFACT_SCHEMA_VERSION)
    throw new Error(`Routing artifact uses unsupported schema version ${isRecord(parsed) ? String(parsed.schemaVersion) : 'unknown'}`)
  if (!isRecord(parsed.workload))
    throw new Error('Routing artifact has no workload definition')

  const targetIds = recordIds(parsed.targets, 'target')
  const scenarioIds = recordIds(parsed.workload.scenarios, 'scenario')
  if (!Array.isArray(parsed.measurements))
    throw new Error('Routing artifact has no measurements')
  if (!Array.isArray(parsed.repeats) || parsed.repeats.length === 0)
    throw new Error('Routing artifact has no retained repeats')

  const identities = new Set<string>()
  const cpuSources = new Set<string>()
  let rawFileCount = 0
  for (const value of parsed.repeats) {
    if (!isRecord(value)
      || typeof value.targetId !== 'string'
      || typeof value.scenarioId !== 'string'
      || !Number.isSafeInteger(value.run)
      || (value.run as number) < 1)
      throw new Error('Routing artifact contains a malformed repeat identity')
    if (!targetIds.has(value.targetId) || !scenarioIds.has(value.scenarioId))
      throw new Error(`Routing artifact repeat references an unknown target or scenario: ${value.targetId}:${value.scenarioId}`)

    const identity = `${value.targetId}:${value.scenarioId}:${value.run}`
    if (identities.has(identity))
      throw new Error(`Routing artifact contains duplicate repeat identity ${identity}`)
    identities.add(identity)

    if (value.cpuSource !== null && value.cpuSource !== 'proc' && value.cpuSource !== 'ps' && value.cpuSource !== 'mixed')
      throw new Error(`Routing artifact repeat ${identity} has an invalid CPU sample source`)
    cpuSources.add(value.cpuSource === null ? 'none' : value.cpuSource)
    if (!Number.isSafeInteger(value.rawBytes) || (value.rawBytes as number) <= 0)
      throw new Error(`Routing artifact repeat ${identity} has an invalid raw byte count`)

    const rawPath = `raw/${value.targetId}--${value.scenarioId}--run${value.run}.txt`
    const rawFile = artifactRelativeFile(root, value.rawOutputFile, rawPath, 'Routing artifact measured output')
    const rawSize = regularArtifactFileSize(rawFile, 'Routing artifact measured output')
    if (rawSize !== value.rawBytes)
      throw new Error(`Routing artifact repeat ${identity} raw byte count is ${value.rawBytes}, but its file has ${rawSize}`)
    rawFileCount++

    if (value.warmupOutputFile !== null) {
      const warmupPath = `raw/${value.targetId}--${value.scenarioId}--run${value.run}--warmup.txt`
      regularArtifactFileSize(
        artifactRelativeFile(root, value.warmupOutputFile, warmupPath, 'Routing artifact warm-up output'),
        'Routing artifact warm-up output',
      )
      rawFileCount++
    }
  }

  const artifact = parsed as unknown as RoutingArtifact
  const regenerated = renderReport({
    meta: artifact.meta,
    scenarios: artifact.workload.scenarios,
    targets: artifact.targets,
    measurements: artifact.measurements,
    repeats: artifact.repeats,
  })
  const retained = readFileSync(resolve(root, 'report.md'), 'utf8')
  if (retained !== regenerated)
    throw new Error('Routing artifact report.md does not match its structured evidence')

  return {
    cpuSources: [...cpuSources].sort(),
    rawFileCount,
    repeatCount: parsed.repeats.length,
  }
}

function parseDirectory(args: readonly string[]): string {
  if (args.length !== 1 || !args[0]!.startsWith('--directory=') || args[0]!.length === '--directory='.length)
    throw new Error('Usage: bun bench/routing/verify-artifact.ts --directory=<artifact-directory>')
  return args[0]!.slice('--directory='.length)
}

if (import.meta.main) {
  const result = verifyRoutingArtifactDirectory(parseDirectory(process.argv.slice(2)))
  console.log(`Verified ${result.repeatCount} routing repeat(s), ${result.rawFileCount} raw file(s), CPU sources: ${result.cpuSources.join(', ')}`)
}
