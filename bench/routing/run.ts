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
import type { Scenario } from './scenarios'
import type { Target } from './targets'
import { mkdirSync, writeFileSync } from 'node:fs'
import { cpus, platform, release } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { pickDriver } from './drivers'
import { createFixture } from './fixture'
import { renderReport } from './report'
import { CSRF_COOKIE, CSRF_TOKEN, SCENARIOS } from './scenarios'
import { TARGETS } from './targets'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const REPO_ROOT = join(HERE, '..', '..')
const TMP = join(HERE, '.tmp')
const FIXTURE = join(TMP, 'bench.sqlite')
const PORT = Number(process.env.BENCH_PORT ?? 39400)

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

function parseArgs(argv: string[]): Options {
  const opts: Options = {
    targets: TARGETS.map(t => t.id),
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
      if (value == null) throw new Error(`${arg} needs a value`)
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
  return opts
}

const HELP = `bun bench/routing/run.ts [flags]

  --targets      comma-separated target ids  (${TARGETS.map(t => t.id).join(', ')})
  --scenarios    comma-separated scenario ids (${SCENARIOS.map(s => s.id).join(', ')})
  --driver       oha | bombardier | autocannon | builtin  (default: first available)
  --connections  concurrent connections (default 50)
  --warmup       seconds discarded before measuring (default 5)
  --duration     seconds measured (default 30)
  --runs         repeats per scenario, median reported (default 3)
  --no-db        skip the SQLite fixture and the db-roundtrip scenario`

interface BootedServer {
  proc: ReturnType<typeof Bun.spawn>
  pid: number
}

async function boot(target: Target, withDb: boolean): Promise<BootedServer | { skipped: string }> {
  const proc = Bun.spawn(['bun', join(HERE, 'servers', target.server)], {
    cwd: REPO_ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      ...process.env,
      BENCH_PORT: String(PORT),
      BENCH_DB: withDb ? '1' : '0',
      BENCH_DB_FILE: FIXTURE,
      DB_DATABASE_PATH: FIXTURE,
      ...target.env,
    } as Record<string, string>,
  })

  const deadline = Date.now() + 60_000
  for (;;) {
    if (proc.exitCode != null) {
      const err = await new Response(proc.stderr).text()
      // 78 is EX_CONFIG: the server said "I am not installed here".
      if (proc.exitCode === 78 || target.optional)
        return { skipped: err.trim().split('\n').pop() || `exited ${proc.exitCode}` }
      throw new Error(`${target.id} server exited ${proc.exitCode}:\n${err}`)
    }
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/bench/json`)
      if (res.ok) {
        await res.arrayBuffer()
        break
      }
    }
    catch { /* not listening yet */ }
    if (Date.now() > deadline)
      throw new Error(`${target.id} server did not become ready within 60s`)
    await Bun.sleep(100)
  }

  return { proc, pid: proc.pid }
}

async function stop(server: BootedServer): Promise<void> {
  server.proc.kill()
  await server.proc.exited
}

function headersFor(target: Target, scenario: Scenario): Record<string, string> {
  const headers: Record<string, string> = {}
  if (scenario.body != null) headers['content-type'] = 'application/json'

  // Unsafe methods always carry the double-submit pair. The cold-client
  // profile is about what a first-time GET costs; it is not a claim that a
  // client can mutate state without a token, and pretending otherwise would
  // measure a 403 instead of a route.
  const unsafe = scenario.method !== 'GET'
  if (target.cookie || unsafe) headers.cookie = CSRF_COOKIE
  if (unsafe) headers['x-csrf-token'] = CSRF_TOKEN

  return headers
}

/**
 * Every target must answer every scenario with the same bytes. A faster server
 * that 404s, 422s, or returns a shorter body is not a faster server, and this
 * is the only thing standing between the report and that mistake.
 */
async function assertParity(target: Target, scenario: Scenario): Promise<void> {
  const res = await fetch(`http://127.0.0.1:${PORT}${scenario.path}`, {
    method: scenario.method,
    headers: headersFor(target, scenario),
    ...(scenario.body != null ? { body: scenario.body } : {}),
  })
  const text = (await res.text()).trim()
  if (!res.ok)
    throw new Error(`${target.id} answered ${res.status} for ${scenario.id}: ${text.slice(0, 200)}`)
  if (text !== scenario.expect)
    throw new Error(`${target.id} answered ${text.slice(0, 200)} for ${scenario.id}, expected ${scenario.expect}`)
}

/**
 * CPU time the server actually burned, as a percentage of one core.
 *
 * Deltas of cumulative CPU time, not `ps -o %cpu`: on macOS that column is an
 * average over the process's whole lifetime, so a server that just booted
 * reports its own startup mixed into every reading and a long run reports a
 * number that keeps sliding. Two samples and the wall clock between them
 * answer the question the report is actually asking - "was that throughput won
 * by being efficient, or by using more CPU".
 */
async function cpuSeconds(pid: number): Promise<number | null> {
  try {
    const proc = Bun.spawn(['ps', '-o', 'time=', '-p', String(pid)], { stdout: 'pipe', stderr: 'ignore' })
    const out = (await new Response(proc.stdout).text()).trim()
    if (!out) return null
    // `[dd-]hh:]mm:ss[.ff]`
    const parts = out.replace('-', ':').split(':').map(Number.parseFloat)
    if (parts.some(n => !Number.isFinite(n))) return null
    return parts.reduce((total, part) => total * 60 + part, 0)
  }
  catch {
    return null
  }
}

async function measureCpu(pid: number): Promise<() => Promise<number | null>> {
  const before = await cpuSeconds(pid)
  const wallStart = performance.now()
  return async () => {
    const after = await cpuSeconds(pid)
    const wallSeconds = (performance.now() - wallStart) / 1000
    if (before == null || after == null || wallSeconds <= 0) return null
    return ((after - before) / wallSeconds) * 100
  }
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2))
  const driver: Driver = await pickDriver(opts.driver)

  const scenarios = SCENARIOS.filter(s => opts.scenarios.includes(s.id) && (opts.db || !s.requiresDb))
  const targets = TARGETS.filter(t => opts.targets.includes(t.id))
  const withDb = scenarios.some(s => s.requiresDb)

  if (withDb) {
    console.error(`[bench] building SQLite fixture at ${FIXTURE}`)
    createFixture(FIXTURE)
  }

  const startedAt = new Date().toISOString()
  const outDir = join(HERE, 'results', startedAt.replace(/[:.]/g, '-'))
  const rawDir = join(outDir, 'raw')
  mkdirSync(rawDir, { recursive: true })

  const meta: RunMeta = {
    startedAt,
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
          const finishCpu = await measureCpu(booted.pid)
          const result = await driver.run({
            url: `http://127.0.0.1:${PORT}${scenario.path}`,
            method: scenario.method,
            body: scenario.body,
            headers: headersFor(target, scenario),
            connections: opts.connections,
            warmupSeconds: opts.warmupSeconds,
            durationSeconds: opts.durationSeconds,
          })
          const cpuPercent = await finishCpu()
          if (cpuPercent != null) cpuReadings.push(cpuPercent)

          results.push(result)
          writeFileSync(join(rawDir, `${target.id}--${scenario.id}--run${run}.txt`), result.raw)
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

await main()
