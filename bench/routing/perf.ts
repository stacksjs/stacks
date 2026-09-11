/**
 * Machine-level diagnostics for one target, on Linux.
 *
 * Everything else in this directory measures wall-clock CPU through `ps`,
 * which reports hundredths of a second - at 8,000 req/s over 30 seconds that
 * is 0.042us of resolution, and three separate attempts to explain the last
 * half-microsecond of Stacks' cost ran into that floor (stacksjs/stacks#2597).
 *
 * `perf stat` reads the same CPU time from the kernel in nanoseconds, so
 * `task-clock` over a fixed-rate load answers the same question three orders
 * of magnitude more precisely, and it does it with software events that need
 * no PMU - which matters because a hosted runner is a VM and usually exposes
 * none. Hardware counters are attempted separately and their absence is
 * recorded rather than fatal.
 *
 * `perf record` then says where that time goes: kernel, Bun's own native code,
 * or JIT-compiled JavaScript. Bun emits no jitdump, so JIT frames stay
 * anonymous - which is itself the measurement, because the share of samples
 * that land in anonymous executable memory versus the runtime's symbols is
 * exactly what a JavaScript-level profiler cannot see.
 *
 * Never a throughput comparison: profiling changes execution cost.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { arch, cpus, platform, release } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { pickDriver } from './drivers'
import { createFixture } from './fixture'
import { checkHostLoad } from './host-load'
import type { BusyProcess } from './host-load'
import { resolvePeerVersions } from './peer-versions'
import { resolveStacksRuntimeDependencies, resolveStacksSourceModules } from './provenance'
import { assertParity, assertStableParity, benchmarkQueryLoggingEnabled, boot, FIXTURE, headersFor, PORT, REPO_ROOT, stop } from './runtime'
import { SCENARIOS } from './scenarios'
import { readSourceState } from './source'
import { TARGETS } from './targets'

const HERE = fileURLToPath(new URL('.', import.meta.url))

/** Software events only: always available, including inside a VM. */
const SOFTWARE_EVENTS = 'task-clock,context-switches,cpu-migrations,page-faults,minor-faults,major-faults'
/** Attempted separately, because a hosted runner usually exposes no PMU. */
const HARDWARE_EVENTS = 'cycles,instructions,branches,branch-misses,cache-references,cache-misses'

interface Options {
  targets: string[]
  scenario: string
  rate: number
  durationSeconds: number
  warmupSeconds: number
  output?: string
  allowBusyHost: boolean
}

export function parseArgs(argv: string[]): Options {
  const opts: Options = {
    targets: ['stacks-minimal', 'elysia'],
    scenario: 'path-param',
    rate: 8000,
    durationSeconds: 20,
    warmupSeconds: 5,
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
      case '--scenario': opts.scenario = next(); break
      case '--rate': opts.rate = Number(next()); break
      case '--duration': opts.durationSeconds = Number(next()); break
      case '--warmup': opts.warmupSeconds = Number(next()); break
      case '--output': opts.output = next(); break
      case '--allow-busy-host': opts.allowBusyHost = true; break
      default: throw new Error(`Unknown flag ${arg}`)
    }
  }
  if (!Number.isSafeInteger(opts.rate) || opts.rate <= 0)
    throw new Error('--rate must be a positive safe integer')
  if (!Number.isFinite(opts.durationSeconds) || opts.durationSeconds <= 0)
    throw new Error('--duration must be a positive finite number')
  const unknown = opts.targets.filter(id => !TARGETS.some(target => target.id === id))
  if (unknown.length > 0)
    throw new Error(`Unknown target(s): ${unknown.join(', ')}`)
  if (!SCENARIOS.some(scenario => scenario.id === opts.scenario))
    throw new Error(`Unknown scenario ${opts.scenario}`)
  return opts
}

async function run(cmd: string[]): Promise<{ code: number, stdout: string, stderr: string }> {
  const child = Bun.spawn(cmd, { stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  return { code, stdout, stderr }
}

/**
 * A `perf` that can actually attach.
 *
 * The `perf` wrapper on Ubuntu refuses to run when no `linux-tools` package
 * matches the running kernel, which on a hosted runner is the normal case. The
 * versioned binaries that `linux-tools-generic` installs work anyway for
 * software events, so they are tried directly before giving up.
 */
export async function resolvePerfBinary(candidates: readonly string[]): Promise<string | null> {
  for (const candidate of candidates) {
    try {
      const probe = await run([candidate, '--version'])
      if (probe.code === 0 && /perf version/i.test(probe.stdout + probe.stderr))
        return candidate
    }
    catch {
      // Not on this host at all, which is the ordinary case for every
      // candidate but one.
    }
  }
  return null
}

async function perfCandidates(): Promise<string[]> {
  const globbed = await Array.fromAsync(new Bun.Glob('*/perf').scan({ cwd: '/usr/lib/linux-tools', absolute: true, onlyFiles: false }))
  return ['perf', ...globbed.sort().reverse()]
}

/** What the kernel will let us read, recorded so an empty profile has a reason. */
async function readPerfPermissions(): Promise<Record<string, string>> {
  const paths = {
    perfEventParanoid: '/proc/sys/kernel/perf_event_paranoid',
    kptrRestrict: '/proc/sys/kernel/kptr_restrict',
  }
  const permissions: Record<string, string> = {}
  for (const [name, path] of Object.entries(paths)) {
    try {
      permissions[name] = (await Bun.file(path).text()).trim()
    }
    catch {
      permissions[name] = 'unavailable'
    }
  }
  return permissions
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2))
  if (platform() !== 'linux')
    throw new Error(`perf diagnostics need Linux; this host is ${platform()}`)

  const observed = new Map<number, BusyProcess>()
  await checkHostLoad(opts.allowBusyHost, observed)

  const perf = await resolvePerfBinary(await perfCandidates())
  if (!perf)
    throw new Error('No usable perf binary. Install linux-tools-common and linux-tools-generic.')

  const driver = await pickDriver('oha')
  if (!driver.supportsFixedRate)
    throw new Error('perf diagnostics need a load generator that can pace requests')

  const scenario = SCENARIOS.find(s => s.id === opts.scenario)!
  const targets = TARGETS.filter(t => opts.targets.includes(t.id))
  const startedAt = new Date().toISOString()
  const outDir = resolve(opts.output ?? join(HERE, 'results', `perf-${startedAt.replace(/[:.]/g, '-')}`))
  mkdirSync(outDir, { recursive: true })

  if (scenario.requiresDb)
    createFixture(FIXTURE)

  const meta = {
    kind: 'machine-profile',
    publishable: false,
    reason: 'Sampling and counter collection change execution cost. These artifacts locate work; they are not a ranking.',
    startedAt,
    scenario: scenario.id,
    rate: opts.rate,
    durationSeconds: opts.durationSeconds,
    warmupSeconds: opts.warmupSeconds,
    perfBinary: perf,
    perfVersion: (await run([perf, '--version'])).stdout.trim(),
    perfPermissions: await readPerfPermissions(),
    driver: driver.name,
    driverVersion: await driver.version(),
    runtime: Bun.version,
    machine: { arch: arch(), platform: platform(), release: release(), cpu: cpus()[0]?.model ?? 'unknown', cores: cpus().length },
    source: await readSourceState(REPO_ROOT),
    stacksSourceModules: targets.some(t => t.server === 'stacks.ts') ? resolveStacksSourceModules(REPO_ROOT) : undefined,
    stacksRuntimeDependencies: targets.some(t => t.server === 'stacks.ts') ? resolveStacksRuntimeDependencies(REPO_ROOT) : undefined,
    peerVersions: await resolvePeerVersions(targets.map(t => t.id)),
    persistentQueryLogging: benchmarkQueryLoggingEnabled(),
    busyHostProcesses: [...observed.values()],
  }

  const summary: Array<Record<string, unknown>> = []

  for (const target of targets) {
    console.error(`\n[perf] === ${target.id}`)
    const booted = await boot(target, scenario.requiresDb === true, scenario)
    if ('skipped' in booted) {
      console.error(`[perf]   skipped: ${booted.skipped}`)
      summary.push({ targetId: target.id, skipped: booted.skipped })
      continue
    }

    try {
      const before = await assertParity(target, scenario)
      const request = {
        url: `http://127.0.0.1:${PORT}${scenario.path}`,
        method: scenario.method,
        body: scenario.body,
        headers: headersFor(target, scenario),
        connections: 25,
        requestRate: opts.rate,
        warmupSeconds: 0,
      }

      await driver.run({ ...request, durationSeconds: opts.warmupSeconds })

      // Counters and samples come from separate load windows: `perf record`
      // perturbs the process it samples, so folding it into the window the
      // counters describe would report a cost that includes the profiler.
      const counted = counterWindow(perf, booted.pid, opts.durationSeconds)
      const countedLoad = await driver.run({ ...request, durationSeconds: opts.durationSeconds })
      const counters = await counted

      const sampled = recordWindow(perf, booted.pid, opts.durationSeconds, join(outDir, `${target.id}.perf.data`))
      const sampledLoad = await driver.run({ ...request, durationSeconds: opts.durationSeconds })
      const record = await sampled

      const after = await assertParity(target, scenario)
      assertStableParity(target, scenario, before, after)

      const report = record.code === 0
        ? await run([perf, 'report', '--stdio', '--no-children', '--percent-limit', '0.2', '-i', join(outDir, `${target.id}.perf.data`), '--sort', 'dso,symbol'])
        : { code: record.code, stdout: '', stderr: record.stderr }

      writeFileSync(join(outDir, `${target.id}--counters.txt`), `${counters.software.stderr}\n\n${counters.hardware.stderr}\n`)
      writeFileSync(join(outDir, `${target.id}--report.txt`), report.stdout || report.stderr)
      writeFileSync(join(outDir, `${target.id}--load.json`), `${countedLoad.raw}\n`)

      const taskClockMs = parseTaskClockMs(counters.software.stderr)
      summary.push({
        targetId: target.id,
        requestsCounted: countedLoad.requests,
        errorsCounted: countedLoad.errors,
        rateAttained: countedLoad.requests / (opts.rate * opts.durationSeconds),
        taskClockMs,
        cpuMicrosPerRequest: taskClockMs != null && countedLoad.requests > 0
          ? (taskClockMs * 1000) / countedLoad.requests
          : null,
        hardwareCountersAvailable: !/not supported|not counted/i.test(counters.hardware.stderr) && counters.hardware.code === 0,
        recordExitCode: record.code,
        sampledRequests: sampledLoad.requests,
        parity: { before, after },
      })
      console.error(`[perf]   ${taskClockMs ?? '?'}ms CPU over ${countedLoad.requests} requests`)
    }
    finally {
      await stop(booted)
    }
    await checkHostLoad(opts.allowBusyHost, observed)
  }

  meta.busyHostProcesses = [...observed.values()]
  writeFileSync(join(outDir, 'perf-metadata.json'), `${JSON.stringify({ ...meta, sourceAtEnd: await readSourceState(REPO_ROOT), summary }, null, 2)}\n`)
  console.error(`\n[perf] artifacts written to ${outDir}\n`)
  console.log(JSON.stringify(summary, null, 2))
}

function counterWindow(perf: string, pid: number, seconds: number): Promise<{ software: Awaited<ReturnType<typeof run>>, hardware: Awaited<ReturnType<typeof run>> }> {
  // Both counter sets over the same window, as two attachments, so a missing
  // PMU cannot take the software numbers down with it.
  return Promise.all([
    run([perf, 'stat', '-e', SOFTWARE_EVENTS, '-p', String(pid), '--', 'sleep', String(seconds)]),
    run([perf, 'stat', '-e', HARDWARE_EVENTS, '-p', String(pid), '--', 'sleep', String(seconds)]),
  ]).then(([software, hardware]) => ({ software, hardware }))
}

function recordWindow(perf: string, pid: number, seconds: number, output: string): Promise<Awaited<ReturnType<typeof run>>> {
  return run([perf, 'record', '-F', '997', '-g', '-e', 'cpu-clock', '-p', String(pid), '-o', output, '--', 'sleep', String(seconds)])
}

/** `perf stat` prints task-clock in milliseconds, with a locale separator. */
export function parseTaskClockMs(output: string): number | null {
  const match = /^\s*([\d,.]+)\s+msec\s+task-clock/m.exec(output)
  if (!match)
    return null
  const value = Number(match[1]!.replace(/,/g, ''))
  return Number.isFinite(value) ? value : null
}

if (import.meta.main)
  await main()
