/**
 * Measure server RSS after sustained load and a quiet idle period.
 *
 *   bun bench/memory/run.ts
 *   bun bench/memory/run.ts --targets stacks,bun-raw --load 60 --idle 180
 *   bun bench/memory/run.ts --load 2 --idle 3 --runs 1 --output /tmp/memory-smoke
 */

import type { Driver, LoadResult } from '../routing/drivers'
import type { MemoryMeasurement, MemoryRunMeta, MemorySample } from './report'
import type { Scenario } from '../routing/scenarios'
import type { Target } from '../routing/targets'
import type { MemoryProfileTarget } from './profile'
import { mkdirSync, writeFileSync } from 'node:fs'
import { cpus, platform, release } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { pickDriver } from '../routing/drivers'
import { createFixture } from '../routing/fixture'
import { assertParity, boot, FIXTURE, headersFor, PORT, REPO_ROOT, stop } from '../routing/runtime'
import { SCENARIOS } from '../routing/scenarios'
import { readSourceState } from '../routing/source'
import { readRuntimeRequirement, runtimeMismatchWarning } from '../routing/runtime-version'
import { TARGETS } from '../routing/targets'
import { BUN_141_API_PROFILE } from './profile'
import { residentTreeBytes } from './process'
import { median, renderMemoryReport } from './report'

const HERE = fileURLToPath(new URL('.', import.meta.url))

interface Options {
  targets: string[]
  scenario: string
  driver?: string
  connections: number
  loadSeconds: number
  idleSeconds: number
  sampleIntervalMs: number
  settleSeconds: number
  runs: number
  output?: string
  requestRate?: number
}

function positiveNumber(flag: string, value: string): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0)
    throw new Error(`${flag} must be a positive number`)
  return parsed
}

function positiveInteger(flag: string, value: string): number {
  const parsed = positiveNumber(flag, value)
  if (!Number.isSafeInteger(parsed)) throw new Error(`${flag} must be a safe integer`)
  return parsed
}

export function parseArgs(argv: string[]): Options {
  const options: Options = {
    targets: BUN_141_API_PROFILE.map(target => target.targetId),
    scenario: 'static-json',
    connections: 64,
    loadSeconds: 60,
    idleSeconds: 180,
    sampleIntervalMs: 100,
    settleSeconds: 10,
    runs: 1,
  }

  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index]!
    const next = () => {
      const value = argv[++index]
      if (value == null) throw new Error(`${flag} needs a value`)
      return value
    }
    switch (flag) {
      case '--targets': options.targets = next().split(','); break
      case '--scenario': options.scenario = next(); break
      case '--driver': options.driver = next(); break
      case '--connections': case '-c': options.connections = positiveInteger(flag, next()); break
      case '--load': options.loadSeconds = positiveNumber(flag, next()); break
      case '--idle': options.idleSeconds = positiveNumber(flag, next()); break
      case '--interval': options.sampleIntervalMs = positiveNumber(flag, next()); break
      case '--settle': options.settleSeconds = positiveNumber(flag, next()); break
      case '--runs': options.runs = positiveInteger(flag, next()); break
      case '--output': options.output = next(); break
      case '--rate': options.requestRate = positiveNumber(flag, next()); break
      case '--help': case '-h':
        console.log(HELP)
        process.exit(0)
        break
      default: throw new Error(`Unknown flag ${flag}`)
    }
  }

  options.settleSeconds = Math.min(options.settleSeconds, options.idleSeconds)
  return options
}

const HELP = `bun bench/memory/run.ts [flags]

  --targets      comma-separated target ids (${TARGETS.map(target => target.id).join(', ')})
  --scenario     routing scenario to load (default static-json)
  --driver       oha | bombardier | autocannon | builtin
  --connections  concurrent connections, positive integer (default 64)
  --rate         override the profile's fixed requests per second for every target
  --load         sustained-load seconds (default 60)
  --idle         quiet seconds after load (default 180)
  --interval     RSS sample interval in milliseconds (default 100)
  --settle       final idle window used for the median (default 10)
  --runs         positive integer fresh-process repeats per target (default 1)
  --output       explicit output directory (default results/<timestamp>)`

interface SelectedTarget extends MemoryProfileTarget {
  target: Target
}

function resolveTargets(ids: string[], requestRate?: number): SelectedTarget[] {
  const unknown = ids.filter(id => !TARGETS.some(target => target.id === id))
  if (unknown.length > 0) throw new Error(`Unknown target(s): ${unknown.join(', ')}`)
  return ids.map((id) => {
    const target = TARGETS.find(candidate => candidate.id === id)!
    const profile = BUN_141_API_PROFILE.find(candidate => candidate.targetId === id)
    const rate = requestRate ?? profile?.requestRate
    if (rate == null) throw new Error(`Target '${id}' has no fixed request rate; pass --rate`)
    return { target, targetId: id, label: profile?.label ?? target.label, requestRate: rate }
  })
}

function resolveScenario(id: string): Scenario {
  const scenario = SCENARIOS.find(candidate => candidate.id === id)
  if (!scenario) throw new Error(`Unknown scenario: ${id}`)
  return scenario
}

async function takeSample(pid: number, phase: MemorySample['phase'], startedAt: number): Promise<MemorySample | null> {
  const rssBytes = await residentTreeBytes(pid)
  return rssBytes == null ? null : {
    elapsedMs: Math.round(performance.now() - startedAt),
    phase,
    rssBytes,
  }
}

async function sampleLoad(
  pid: number,
  intervalMs: number,
  startedAt: number,
  load: Promise<LoadResult>,
  samples: MemorySample[],
): Promise<LoadResult> {
  let result: LoadResult | undefined
  let failure: unknown
  let complete = false
  const observed = load.then(
    value => { result = value },
    error => { failure = error },
  ).finally(() => { complete = true })

  while (!complete) {
    const sample = await takeSample(pid, 'load', startedAt)
    if (sample) samples.push(sample)
    await Bun.sleep(intervalMs)
  }
  await observed
  if (failure) throw failure
  return result!
}

async function sampleIdle(
  pid: number,
  intervalMs: number,
  idleSeconds: number,
  startedAt: number,
  samples: MemorySample[],
): Promise<number> {
  const idleStartedAt = performance.now()
  const deadline = idleStartedAt + idleSeconds * 1000
  while (performance.now() < deadline) {
    const sample = await takeSample(pid, 'idle', startedAt)
    if (sample) samples.push(sample)
    await Bun.sleep(Math.min(intervalMs, Math.max(0, deadline - performance.now())))
  }
  const finalSample = await takeSample(pid, 'idle', startedAt)
  if (finalSample) samples.push(finalSample)
  return idleStartedAt
}

async function measure(
  target: Target,
  scenario: Scenario,
  driver: Driver,
  options: Options,
  requestRate: number,
): Promise<
  | { skipped: string }
  | { measurement: Omit<MemoryMeasurement, 'targetId' | 'run' | 'requestRate'>, samples: MemorySample[], load: LoadResult }
> {
  const booted = await boot(target, Boolean(scenario.requiresDb), scenario)
  if ('skipped' in booted) return booted

  try {
    await assertParity(target, scenario)
    const samples: MemorySample[] = []
    const startedAt = performance.now()
    const load = await sampleLoad(booted.pid, options.sampleIntervalMs, startedAt, driver.run({
      url: `http://127.0.0.1:${PORT}${scenario.path}`,
      method: scenario.method,
      body: scenario.body,
      headers: headersFor(target, scenario),
      connections: options.connections,
      warmupSeconds: 0,
      durationSeconds: options.loadSeconds,
      requestRate,
    }), samples)
    const idleStartedAt = await sampleIdle(booted.pid, options.sampleIntervalMs, options.idleSeconds, startedAt, samples)

    const settledAfter = (idleStartedAt - startedAt) + (options.idleSeconds - options.settleSeconds) * 1000
    const settled = samples.filter(sample => sample.phase === 'idle' && sample.elapsedMs >= settledAfter)
    const underLoad = samples.filter(sample => sample.phase === 'load')
    if (settled.length === 0 || underLoad.length === 0)
      throw new Error(`RSS sampling returned no ${settled.length === 0 ? 'settled idle' : 'load'} readings`)

    return {
      measurement: {
        settledRssBytes: median(settled.map(sample => sample.rssBytes)),
        peakLoadRssBytes: Math.max(...underLoad.map(sample => sample.rssBytes)),
        rpsMean: load.rpsMean,
        requests: load.requests,
        errors: load.errors,
      },
      samples,
      load,
    }
  }
  finally {
    await stop(booted)
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  const runtimeRequirement = await readRuntimeRequirement(REPO_ROOT)
  const runtimeWarning = runtimeMismatchWarning(runtimeRequirement, Bun.version)
  if (runtimeWarning) console.error(`[memory] ${runtimeWarning}`)
  const targets = resolveTargets(options.targets, options.requestRate)
  const scenario = resolveScenario(options.scenario)
  const driver = await pickDriver(options.driver)
  if (!driver.supportsFixedRate)
    throw new Error(`Load driver '${driver.name}' cannot enforce a fixed request rate. Install oha and rerun this benchmark.`)

  if (scenario.requiresDb) createFixture(FIXTURE)

  const source = await readSourceState(REPO_ROOT)
  const startedAt = new Date().toISOString()
  const outDir = options.output ?? join(HERE, 'results', startedAt.replace(/[:.]/g, '-'))
  const rawDir = join(outDir, 'raw')
  mkdirSync(rawDir, { recursive: true })

  const meta: MemoryRunMeta = {
    startedAt,
    source,
    runtimeRequirement,
    driver: driver.name,
    publishable: driver.publishable && platform() === 'linux' && process.env.BENCH_DEDICATED === '1',
    scenario: scenario.id,
    connections: options.connections,
    loadSeconds: options.loadSeconds,
    idleSeconds: options.idleSeconds,
    sampleIntervalMs: options.sampleIntervalMs,
    settleSeconds: options.settleSeconds,
    runs: options.runs,
    machine: {
      platform: platform(),
      release: release(),
      cpu: cpus()[0]?.model ?? 'unknown',
      cores: cpus().length,
      bun: Bun.version,
    },
  }

  if (!(driver.publishable && platform() === 'linux' && process.env.BENCH_DEDICATED === '1'))
    console.error('[memory] this is a direction-only run; publishing requires oha on dedicated Linux x64 hardware')

  const measurements: MemoryMeasurement[] = []
  const targetRows: Array<{ id: string, label: string, requestRate: number, skipped?: string }> = []

  for (const selected of targets) {
    const { target, requestRate } = selected
    console.error(`\n[memory] === ${selected.label} at ${requestRate.toLocaleString('en-US')} req/s`)

    for (let run = 1; run <= options.runs; run++) {
      console.error(`[memory] run ${run}: ${options.loadSeconds}s load, then ${options.idleSeconds}s idle`)
      const result = await measure(target, scenario, driver, options, requestRate)
      if ('skipped' in result) {
        console.error(`[memory] skipped: ${result.skipped}`)
        targetRows.push({ id: target.id, label: selected.label, requestRate, skipped: result.skipped })
        break
      }
      if (run === 1) targetRows.push({ id: target.id, label: selected.label, requestRate })
      measurements.push({ targetId: target.id, run, requestRate, ...result.measurement })
      writeFileSync(join(rawDir, `${target.id}--run${run}.json`), `${JSON.stringify({
        targetId: target.id,
        run,
        samples: result.samples,
        load: result.load,
      }, null, 2)}\n`)
      console.error(`[memory] settled RSS: ${(result.measurement.settledRssBytes / 1024 / 1024).toFixed(1)} MiB`)
    }
  }

  const report = renderMemoryReport({ meta, targets: targetRows, measurements })
  writeFileSync(join(outDir, 'report.md'), report)
  writeFileSync(join(outDir, 'measurements.json'), `${JSON.stringify({ meta, measurements }, null, 2)}\n`)
  console.error(`\n[memory] report written to ${join(outDir, 'report.md')}\n`)
  console.log(report)
}

if (import.meta.main)
  await main()
