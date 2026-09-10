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

import type { Driver } from './drivers'
import type { BusyProcess } from './host-load'
import type { Measurement, RoutingRepeat, RunMeta } from './report'
import type { ScenarioParityEvidence } from './runtime'
import { mkdirSync, writeFileSync } from 'node:fs'
import { arch, cpus, platform, release } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { pickDriver } from './drivers'
import { readRuntimeRequirement, runtimeMismatchWarning } from './runtime-version'
import { createFixture, resetFixtureLogs } from './fixture'
import { checkHostLoad, formatBusyProcess } from './host-load'
import { cpuMicrosPerRequest, measureLoad } from './measurement'
import { resolvePeerVersions } from './peer-versions'
import { verifyLoadPersistence } from './persistence'
import { resolveStacksRuntimeDependencies, resolveStacksSourceModules } from './provenance'
import { routingMeasurementPublicationIssues, routingPublicationIssues } from './publication'
import { renderReport } from './report'
import { assertParity, assertStableParity, benchmarkQueryLoggingEnabled, boot, FIXTURE, headersFor, PORT, REPO_ROOT, stop } from './runtime'
import { balancedTargetOrder } from './schedule'
import { SCENARIOS } from './scenarios'
import { readSourceState, sourceStateChanged } from './source'
import { median, relativeRange, relativeThroughput } from './statistics'
import { DEFAULT_TARGETS, TARGETS } from './targets'

const HERE = fileURLToPath(new URL('.', import.meta.url))

interface Options {
  targets: string[]
  scenarios: string[]
  driver?: string
  connections: number
  /** Hold every target to this fixed request rate instead of saturating. */
  requestRate?: number
  warmupSeconds: number
  durationSeconds: number
  runs: number
  db: boolean
  allowBusyHost: boolean
  output?: string
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
      case '--rate': opts.requestRate = Number(next()); break
      case '--warmup': opts.warmupSeconds = Number(next()); break
      case '--duration': case '-d': opts.durationSeconds = Number(next()); break
      case '--runs': opts.runs = Number(next()); break
      case '--no-db': opts.db = false; break
      case '--allow-busy-host': opts.allowBusyHost = true; break
      case '--output': opts.output = next(); break
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
  if (opts.requestRate != null && (!Number.isSafeInteger(opts.requestRate) || opts.requestRate <= 0))
    throw new Error('--rate must be a positive safe integer')

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
  --rate         hold every target to this fixed req/s and report CPU per request
                 instead of saturating throughput (requires a driver that can
                 pace requests)
  --warmup       non-negative seconds discarded before measuring (default 5)
  --duration     positive seconds measured (default 30)
  --runs         positive integer repeats per scenario, median reported (default 3)
  --no-db        skip the SQLite fixture and the db-roundtrip scenario
  --allow-busy-host
                 run despite competing processes consuming 75% of a core
  --output       explicit output directory (default results/<timestamp>)

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
  const driverVersion = await driver.version()
  // A driver that cannot pace requests would saturate and report a cost per
  // request measured over a different workload for every target.
  if (opts.requestRate != null && !driver.supportsFixedRate)
    throw new Error(`--rate needs a load generator that can pace requests; ${driver.name} cannot`)

  const scenarios = SCENARIOS.filter(s => opts.scenarios.includes(s.id) && (opts.db || !s.requiresDb))
  const targets = TARGETS.filter(t => opts.targets.includes(t.id))
  const peerVersions = await resolvePeerVersions(targets.map(target => target.id))
  const stacksSourceModules = targets.some(target => target.server === 'stacks.ts')
    ? resolveStacksSourceModules(REPO_ROOT)
    : undefined
  const stacksRuntimeDependencies = targets.some(target => target.server === 'stacks.ts')
    ? resolveStacksRuntimeDependencies(REPO_ROOT)
    : {}
  const withDb = scenarios.some(s => s.requiresDb)

  if (withDb) {
    console.error(`[bench] building SQLite fixture at ${FIXTURE}`)
    createFixture(FIXTURE)
  }

  const source = await readSourceState(REPO_ROOT)
  const startedAt = new Date().toISOString()
  const outDir = opts.output ?? join(HERE, 'results', startedAt.replace(/[:.]/g, '-'))
  const rawDir = join(outDir, 'raw')
  mkdirSync(rawDir, { recursive: true })

  const publicationProfile = {
    driverPublishable: driver.publishable,
    driverVersion,
    dedicated: process.env.BENCH_DEDICATED === '1',
    runtimeRequirement,
    source,
    targetIds: targets.map(target => target.id),
    scenarioIds: scenarios.map(scenario => scenario.id),
    peerVersions,
    stacksRuntimeDependencies,
    warmupSeconds: opts.warmupSeconds,
    durationSeconds: opts.durationSeconds,
    runs: opts.runs,
    busyHostProcesses: [...observedBusyProcesses.values()],
  }
  const publicationIssues = routingPublicationIssues(publicationProfile)
  const meta: RunMeta = {
    startedAt,
    source,
    stacksSourceModules,
    stacksRuntimeDependencies,
    runtimeRequirement,
    driver: driver.name,
    driverVersion,
    loadTopology: 'same-host',
    peerVersions,
    publishable: publicationIssues.length === 0,
    publicationIssues,
    connections: opts.connections,
    requestRate: opts.requestRate,
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

  if (!meta.publishable)
    console.error(`[bench] direction-only: ${publicationIssues.join('; ')}`)

  const refreshHostLoad = async (): Promise<void> => {
    const busyCount = observedBusyProcesses.size
    await checkHostLoad(opts.allowBusyHost, observedBusyProcesses)
    meta.busyHostProcesses = [...observedBusyProcesses.values()]
    publicationProfile.busyHostProcesses = meta.busyHostProcesses
    meta.publicationIssues = routingPublicationIssues(publicationProfile)
    meta.publishable = meta.publicationIssues.length === 0
    if (observedBusyProcesses.size > busyCount)
      console.error(`[bench] busy-host override: ${meta.busyHostProcesses.map(formatBusyProcess).join(', ')}`)
  }

  const measurements: Measurement[] = []
  const parityChecks: Array<{
    targetId: string
    scenarioId: string
    run: number
    before: ScenarioParityEvidence
    after: ScenarioParityEvidence
  }> = []
  const targetRows: Array<{ id: string, label: string, skipped?: string }> = []
  const availableTargets = new Set<string>()
  const unavailableTargets = new Set<string>()
  const collected = new Map<string, RoutingRepeat[]>()

  for (const scenario of scenarios) {
    console.error(`\n[bench] === ${scenario.title}`)
    for (let run = 1; run <= opts.runs; run++) {
      for (const target of balancedTargetOrder(targets, run - 1, opts.runs)) {
        if (unavailableTargets.has(target.id))
          continue

        await refreshHostLoad()

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
          const parityBefore = await assertParity(target, scenario)
          if (scenario.requiresDb)
            resetFixtureLogs(FIXTURE)
          const { result, cpuSeconds, cpuPercent, warmupResult } = await measureLoad(driver, {
            url: `http://127.0.0.1:${PORT}${scenario.path}`,
            method: scenario.method,
            body: scenario.body,
            headers: headersFor(target, scenario),
            connections: opts.connections,
            requestRate: opts.requestRate,
            warmupSeconds: opts.warmupSeconds,
            durationSeconds: opts.durationSeconds,
          }, booted.pid)
          const key = `${target.id}:${scenario.id}`
          const bucket = collected.get(key) ?? []
          collected.set(key, bucket)

          // Every repeat is retained, including one that produced no CPU
          // reading. Dropping those before the median made a repeat with no
          // CPU evidence invisible to the quality gate (stacksjs/stacks#2470).
          bucket.push({
            targetId: target.id,
            scenarioId: scenario.id,
            run,
            rpsMean: result.rpsMean,
            rpsP50: result.rpsP50,
            latencyMs: result.latencyMs,
            requests: result.requests,
            errors: result.errors,
            cpuPercent,
            cpuMicrosPerRequest: cpuMicrosPerRequest(cpuSeconds, result.requests),
            rateAttained: opts.requestRate == null
              ? null
              : result.requests / (opts.requestRate * opts.durationSeconds),
            rawBytes: result.raw.length,
          })
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
          // Re-run the full parity and validation probe set after load. The
          // first probe proves startup behavior; this one catches a target that
          // changes status, output, or validation behavior after sustained use.
          const parityAfter = await assertParity(target, scenario)
          assertStableParity(target, scenario, parityBefore, parityAfter)
          parityChecks.push({ targetId: target.id, scenarioId: scenario.id, run, before: parityBefore, after: parityAfter })
          console.error(`[bench]   run ${run} ${target.id}: ${Math.round(result.rpsMean).toLocaleString()} req/s`)
        }
        finally {
          await stop(booted)
        }
        await refreshHostLoad()
      }
    }
  }

  for (const target of targets) {
    if (!availableTargets.has(target.id))
      continue
    for (const scenario of scenarios) {
      const results = collected.get(`${target.id}:${scenario.id}`)
      if (!results || results.length !== opts.runs)
        throw new Error(`Incomplete measurements for ${target.id}:${scenario.id}`)
      const rpsValues = results.map(r => r.rpsMean)
      const p50s = results.map(r => r.rpsP50).filter((v): v is number => v != null)
      const rawResults = collected.get(`bun-raw:${scenario.id}`)

      /*
       * Aggregate all-or-nothing.
       *
       * A median taken over the repeats that happened to report a metric is a
       * number with no stated coverage: it reads the same whether three
       * repeats agreed or one repeat was the only evidence. Where a metric is
       * missing from any repeat the aggregate is `null`, which the report
       * renders as `-` and publication rejects with a reason naming the run.
       */
      const everyValue = (pick: (r: RoutingRepeat) => number | null): number | null => {
        const values = results.map(pick)
        return values.every((v): v is number => v != null && Number.isFinite(v)) ? median(values) : null
      }

      // Pooled rather than the mean of per-repeat rates, so a repeat that
      // served fewer requests carries proportionally less weight - and a
      // repeat that served none contributes nothing instead of a free 0.
      const pooledRequests = results.reduce((sum, r) => sum + r.requests, 0)
      const pooledErrors = results.reduce((sum, r) => sum + r.errors, 0)
      const costs = results.map(r => r.cpuMicrosPerRequest)
      const everyCost = costs.every((v): v is number => v != null && Number.isFinite(v)) ? costs as number[] : null

      measurements.push({
        targetId: target.id,
        scenarioId: scenario.id,
        rpsMean: median(rpsValues),
        rpsP50: p50s.length ? median(p50s) : null,
        latencyMs: {
          p50: everyValue(r => r.latencyMs.p50),
          p90: everyValue(r => r.latencyMs.p90),
          p99: everyValue(r => r.latencyMs.p99),
        },
        errorRate: pooledRequests > 0 ? pooledErrors / pooledRequests : null,
        cpuPercent: everyValue(r => r.cpuPercent),
        cpuMicrosPerRequest: everyCost ? median(everyCost) : null,
        cpuCostSpread: everyCost ? { min: Math.min(...everyCost), max: Math.max(...everyCost) } : null,
        rateAttained: everyValue(r => r.rateAttained),
        spread: { min: Math.min(...rpsValues), max: Math.max(...rpsValues) },
        rangeRatio: relativeRange(rpsValues),
        relativeToRaw: rawResults
          ? relativeThroughput(rpsValues, rawResults.map(r => r.rpsMean))
          : null,
        runs: results.length,
      })
    }
  }

  meta.publicationIssues = [...new Set([
    ...(meta.publicationIssues ?? []),
    ...routingMeasurementPublicationIssues(targetRows, scenarios, measurements, opts.runs, parityChecks, [...collected.values()].flat(), opts.requestRate != null),
  ])]
  meta.sourceAtEnd = await readSourceState(REPO_ROOT)
  if (sourceStateChanged(meta.source, meta.sourceAtEnd))
    meta.publicationIssues.push('source state changed during the benchmark')
  meta.publishable = meta.publicationIssues.length === 0

  const report = renderReport({ meta, scenarios, targets: targetRows, measurements })
  writeFileSync(join(outDir, 'report.md'), report)
  writeFileSync(join(outDir, 'measurements.json'), `${JSON.stringify({
    /*
     * 2: latency percentiles and errorRate became nullable, errorRate became
     * pooled rather than the mean of per-repeat rates, cpuPercent requires
     * every repeat to have reported, and `runs` counts repeats RETAINED
     * rather than requested (stacksjs/stacks#2470).
     *
     * The values are unchanged for a clean run - verified against diagnostic
     * 34196555986, where pooled and mean-of-rates agree on all 32 rows - but
     * the definitions differ the moment a repeat fails, so a committed
     * baseline needs to say which rules produced it.
     */
    schemaVersion: 2,
    meta,
    targets: targetRows,
    workload: {
      targetDefinitions: targets,
      scenarios,
      requests: targets.flatMap(target => scenarios.map(scenario => ({
        targetId: target.id,
        scenarioId: scenario.id,
        method: scenario.method,
        path: scenario.path,
        body: scenario.body,
        headers: headersFor(target, scenario),
      }))),
      parityChecks,
    },
    measurements,
  }, null, 2)}\n`)

  console.error(`\n[bench] report written to ${join(outDir, 'report.md')}\n`)
  console.log(report)
}

if (import.meta.main)
  await main()
