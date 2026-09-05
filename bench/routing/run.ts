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
import type { Measurement, RunMeta } from './report'
import { mkdirSync, writeFileSync } from 'node:fs'
import { cpus, platform, release } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { pickDriver } from './drivers'
import { readRuntimeRequirement, runtimeMismatchWarning } from './runtime-version'
import { createFixture, resetFixtureLogs } from './fixture'
import { measureLoad } from './measurement'
import { verifyLoadPersistence } from './persistence'
import { renderReport } from './report'
import { assertParity, boot, FIXTURE, headersFor, PORT, REPO_ROOT, stop } from './runtime'
import { SCENARIOS } from './scenarios'
import { readSourceState } from './source'
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

Available targets: ${TARGETS.map(t => t.id).join(', ')}`

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2))
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
    machine: {
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

  for (const target of targets) {
    console.error(`\n[bench] === ${target.label}`)
    const booted = await boot(target, withDb)
    if ('skipped' in booted) {
      console.error(`[bench] skipped: ${booted.skipped}`)
      targetRows.push({ id: target.id, label: target.label, skipped: booted.skipped })
      continue
    }
    targetRows.push({ id: target.id, label: target.label })

    try {
      for (const scenario of scenarios) {
        await assertParity(target, scenario)

        const results: LoadResult[] = []
        const cpuReadings: number[] = []

        for (let run = 1; run <= opts.runs; run++) {
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
          if (cpuPercent != null) cpuReadings.push(cpuPercent)

          results.push(result)
          writeFileSync(join(rawDir, `${target.id}--${scenario.id}--run${run}.txt`), result.raw)
          if (warmupResult)
            writeFileSync(join(rawDir, `${target.id}--${scenario.id}--run${run}--warmup.txt`), warmupResult.raw)
          if (scenario.requiresDb && target.server === 'stacks.ts') {
            // The fixture was cleared before warmup. Count both load windows,
            // after CPU sampling, so verification cannot inflate measured cost.
            const persistence = await verifyLoadPersistence(FIXTURE, driver, result, warmupResult)
            writeFileSync(join(rawDir, `${target.id}--${scenario.id}--run${run}--persistence.json`), `${JSON.stringify(persistence, null, 2)}\n`)
            if (persistence.status === 'unverified')
              console.error(`[bench] ${persistence.reason}`)
          }
          console.error(`[bench]   ${scenario.id} run ${run}: ${Math.round(result.rpsMean).toLocaleString()} req/s`)
        }

        const rpsValues = results.map(r => r.rpsMean)
        const p50s = results.map(r => r.rpsP50).filter((v): v is number => v != null)
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
          runs: opts.runs,
        })
      }
    }
    finally {
      await stop(booted)
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
