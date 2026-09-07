/**
 * The routing benchmark runner.
 *
 *   bun bench/routing/run.ts                       # everything the machine can run
 *   bun bench/routing/run.ts --targets stacks,bun-raw --scenarios static-json
 *   bun bench/routing/run.ts --driver oha --duration 30 --warmup 5 --runs 3
 *
 * Boots one server at a time, checks that every target answers each scenario
 * with the SAME body before measuring anything, then runs the load generator
 * `--runs` times per scenario and reports the median with its spread. Raw tool
 * output for every single run is written next to the report, because a number
 * with no artifact behind it is not a number this project publishes.
 */

import type { Driver, LoadResult } from './drivers'
import type { BusyProcess } from './host-load'
import type { Measurement, RunMeta } from './report'
import { mkdirSync, writeFileSync } from 'node:fs'
import { arch, cpus, platform, release } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { pickDriver } from './drivers'
import { readRuntimeRequirement, runtimeMismatchWarning } from './runtime-version'
import { createFixture, resetFixtureLogs } from './fixture'
import { checkHostLoad, formatBusyProcess } from './host-load'
import { measureLoad } from './measurement'
import { verifyLoadPersistence } from './persistence'
import { renderReport } from './report'
import { assertParity, benchmarkQueryLoggingEnabled, boot, FIXTURE, headersFor, PORT, REPO_ROOT, stop } from './runtime'
import { rotateTargets } from './schedule'
import { SCENARIOS } from './scenarios'
import { readSourceState } from './source'
import { median, relativeRange, relativeThroughput } from './statistics'
import { DEFAULT_TARGETS, TARGETS } from './targets'

const HERE = fileURLToPath(new URL('.', import.meta.url))

interface Options {
  targets: string[]
  scenarios: string[]
  driver?: string
  connections: number
  warmupSeconds: number
  durationSeconds: number
  runs: number
  db: boolean
  allowBusyHost: boolean
}

export function parseArgs(argv: string[]): Options {
  const opts: Options = {
    targets: DEFAULT_TARGETS.map(t => t.id),
    scenarios: SCENARIOS.map(s => s.id),
    connections: 50,
    warmupSeconds: 5,
    durationSeconds: 30,
    runs: 3,
    db: true,
    allowBusyHost: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    const next = () => {
      const value = argv[++i]
      if (value == null || value.trim() === '') throw new Error(`${arg} needs a value`)
      return value
    }
    switch (arg) {
      case '--targets': opts.targets = next().split(','); break
      case '--scenarios': opts.scenarios = next().split(','); break
      case '--driver': opts.driver = next(); break
      case '--connections': case '-c': opts.connections = Number(next()); break
      case '--warmup': opts.warmupSeconds = Number(next()); break
      case '--duration': case '-d': opts.durationSeconds = Number(next()); break
      case '--runs': opts.runs = Number(next()); break
      case '--no-db': opts.db = false; break
      case '--allow-busy-host': opts.allowBusyHost = true; break
      case '--help': case '-h':
        console.log(HELP)
        process.exit(0)
        break
      default:
        throw new Error(`Unknown flag ${arg}`)
    }
  }
  if (!Number.isSafeInteger(opts.connections) || opts.connections <= 0)
    throw new Error('--connections must be a positive safe integer')
  if (!Number.isSafeInteger(opts.runs) || opts.runs <= 0)
    throw new Error('--runs must be a positive safe integer')
  if (!Number.isFinite(opts.durationSeconds) || opts.durationSeconds <= 0)
    throw new Error('--duration must be a positive finite number')
  if (!Number.isFinite(opts.warmupSeconds) || opts.warmupSeconds < 0)
    throw new Error('--warmup must be a non-negative finite number')

  const unknownTargets = opts.targets.filter(id => !TARGETS.some(target => target.id === id))
  if (unknownTargets.length > 0)
    throw new Error(`Unknown target(s): ${unknownTargets.map(id => JSON.stringify(id)).join(', ')}`)
  const unknownScenarios = opts.scenarios.filter(id => !SCENARIOS.some(scenario => scenario.id === id))
  if (unknownScenarios.length > 0)
    throw new Error(`Unknown scenario(s): ${unknownScenarios.map(id => JSON.stringify(id)).join(', ')}`)
  if (!SCENARIOS.some(scenario => opts.scenarios.includes(scenario.id) && (opts.db || !scenario.requiresDb)))
    throw new Error('No scenarios remain after applying --no-db')

  return opts
}

const HELP = `bun bench/routing/run.ts [flags]

  --targets      comma-separated target ids  (default: ${DEFAULT_TARGETS.map(t => t.id).join(', ')})
  --scenarios    comma-separated scenario ids (${SCENARIOS.map(s => s.id).join(', ')})
  --driver       oha | bombardier | autocannon | builtin  (default: first available)
  --connections  concurrent connections, positive integer (default 50)
  --warmup       non-negative seconds discarded before measuring (default 5)
  --duration     positive seconds measured (default 30)
  --runs         positive integer repeats per scenario, median reported (default 3)
  --no-db        skip the SQLite fixture and the db-roundtrip scenario
  --allow-busy-host
                 run despite another process consuming at least 75% of a core

Available targets: ${TARGETS.map(t => t.id).join(', ')}`

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2))
  const observedBusyProcesses = new Map<number, BusyProcess>()
  await checkHostLoad(opts.allowBusyHost, observedBusyProcesses)
  if (observedBusyProcesses.size > 0)
    console.error(`[bench] busy-host override: ${[...observedBusyProcesses.values()].map(formatBusyProcess).join(', ')}`)
  const runtimeRequirement = await readRuntimeRequirement(REPO_ROOT)
  const runtimeWarning = runtimeMismatchWarning(runtimeRequirement, Bun.version)
  if (runtimeWarning) console.error(`[bench] ${runtimeWarning}`)
  const driver: Driver = await pickDriver(opts.driver)

  const scenarios = SCENARIOS.filter(s => opts.scenarios.includes(s.id) && (opts.db || !s.requiresDb))
  const targets = TARGETS.filter(t => opts.targets.includes(t.id))
  const withDb = scenarios.some(s => s.requiresDb)

  if (withDb) {
    console.error(`[bench] building SQLite fixture at ${FIXTURE}`)
    createFixture(FIXTURE)
  }

  const source = await readSourceState(REPO_ROOT)
  const startedAt = new Date().toISOString()
  const outDir = join(HERE, 'results', startedAt.replace(/[:.]/g, '-'))
  const rawDir = join(outDir, 'raw')
  mkdirSync(rawDir, { recursive: true })

  const meta: RunMeta = {
    startedAt,
    source,
    runtimeRequirement,
    driver: driver.name,
    publishable: driver.publishable,
    connections: opts.connections,
    warmupSeconds: opts.warmupSeconds,
    durationSeconds: opts.durationSeconds,
    runs: opts.runs,
    persistentQueryLogging: benchmarkQueryLoggingEnabled(),
    busyHostProcesses: [...observedBusyProcesses.values()],
    machine: {
      arch: arch(),
      platform: platform(),
      release: release(),
      cpu: cpus()[0]?.model ?? 'unknown',
      cores: cpus().length,
      bun: Bun.version,
    },
  }

  if (!driver.publishable)
    console.error('[bench] using the built-in generator — direction-only, do not publish these numbers')

  const measurements: Measurement[] = []
  const targetRows: Array<{ id: string, label: string, skipped?: string }> = []
  const availableTargets = new Set<string>()
  const unavailableTargets = new Set<string>()
  const collected = new Map<string, { results: LoadResult[], cpuReadings: number[] }>()

  for (let scenarioIndex = 0; scenarioIndex < scenarios.length; scenarioIndex++) {
    const scenario = scenarios[scenarioIndex]!
    console.error(`\n[bench] === ${scenario.title}`)
    for (let run = 1; run <= opts.runs; run++) {
      const measurementIndex = scenarioIndex * opts.runs + run - 1
      for (const target of rotateTargets(targets, measurementIndex)) {
        if (unavailableTargets.has(target.id))
          continue

        await checkHostLoad(opts.allowBusyHost, observedBusyProcesses)
        meta.busyHostProcesses = [...observedBusyProcesses.values()]

        // A fresh process keeps route-table size, database imports, and warm
        // state from one measurement out of every other measurement. Rotating
        // the target order spreads host drift across implementations.
        const booted = await boot(target, scenario.requiresDb === true, scenario)
        if ('skipped' in booted) {
          if (availableTargets.has(target.id))
            throw new Error(`${target.id} became unavailable after earlier measurements: ${booted.skipped}`)
          console.error(`[bench]   ${target.id} skipped: ${booted.skipped}`)
          unavailableTargets.add(target.id)
          targetRows.push({ id: target.id, label: target.label, skipped: booted.skipped })
          continue
        }
        if (!availableTargets.has(target.id)) {
          availableTargets.add(target.id)
          targetRows.push({ id: target.id, label: target.label })
        }

        try {
          await assertParity(target, scenario)
          if (scenario.requiresDb)
            resetFixtureLogs(FIXTURE)
          const { result, cpuPercent, warmupResult } = await measureLoad(driver, {
            url: `http://127.0.0.1:${PORT}${scenario.path}`,
            method: scenario.method,
            body: scenario.body,
            headers: headersFor(target, scenario),
            connections: opts.connections,
            warmupSeconds: opts.warmupSeconds,
            durationSeconds: opts.durationSeconds,
          }, booted.pid)
          const key = `${target.id}:${scenario.id}`
          const bucket = collected.get(key) ?? { results: [], cpuReadings: [] }
          collected.set(key, bucket)
          if (cpuPercent != null) bucket.cpuReadings.push(cpuPercent)

          bucket.results.push(result)
          writeFileSync(join(rawDir, `${target.id}--${scenario.id}--run${run}.txt`), result.raw)
          if (warmupResult)
            writeFileSync(join(rawDir, `${target.id}--${scenario.id}--run${run}--warmup.txt`), warmupResult.raw)
          if (benchmarkQueryLoggingEnabled() && scenario.requiresDb && target.server === 'stacks.ts') {
            // The fixture was cleared before warmup. Count both load windows,
            // after CPU sampling, so verification cannot inflate measured cost.
            const persistence = await verifyLoadPersistence(FIXTURE, driver, result, warmupResult)
            writeFileSync(join(rawDir, `${target.id}--${scenario.id}--run${run}--persistence.json`), `${JSON.stringify(persistence, null, 2)}\n`)
            if (persistence.status === 'unverified')
              console.error(`[bench] ${persistence.reason}`)
          }
          console.error(`[bench]   run ${run} ${target.id}: ${Math.round(result.rpsMean).toLocaleString()} req/s`)
        }
        finally {
          await stop(booted)
        }
      }
    }
  }

  for (const target of targets) {
    if (!availableTargets.has(target.id))
      continue
    for (const scenario of scenarios) {
      const bucket = collected.get(`${target.id}:${scenario.id}`)
      if (!bucket || bucket.results.length !== opts.runs)
        throw new Error(`Incomplete measurements for ${target.id}:${scenario.id}`)
      const { results, cpuReadings } = bucket
      const rpsValues = results.map(r => r.rpsMean)
      const p50s = results.map(r => r.rpsP50).filter((v): v is number => v != null)
      const rawResults = collected.get(`bun-raw:${scenario.id}`)?.results
      measurements.push({
        targetId: target.id,
        scenarioId: scenario.id,
        rpsMean: median(rpsValues),
        rpsP50: p50s.length ? median(p50s) : null,
        latencyMs: {
          p50: median(results.map(r => r.latencyMs.p50)),
          p90: median(results.map(r => r.latencyMs.p90)),
          p99: median(results.map(r => r.latencyMs.p99)),
        },
        errorRate: results.reduce((sum, r) => sum + (r.requests ? r.errors / r.requests : 0), 0) / results.length,
        cpuPercent: cpuReadings.length ? median(cpuReadings) : null,
        spread: { min: Math.min(...rpsValues), max: Math.max(...rpsValues) },
        rangeRatio: relativeRange(rpsValues),
        relativeToRaw: rawResults
          ? relativeThroughput(rpsValues, rawResults.map(r => r.rpsMean))
          : null,
        runs: opts.runs,
      })
    }
  }

  const report = renderReport({ meta, scenarios, targets: targetRows, measurements })
  writeFileSync(join(outDir, 'report.md'), report)
  writeFileSync(join(outDir, 'measurements.json'), `${JSON.stringify({ meta, measurements }, null, 2)}\n`)

  console.error(`\n[bench] report written to ${join(outDir, 'report.md')}\n`)
  console.log(report)
}

if (import.meta.main)
  await main()
