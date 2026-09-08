/** CPU diagnostics for stock Stacks HTTP requests; never a throughput ranking. */
import { mkdirSync } from 'node:fs'
import { arch, cpus, platform, release } from 'node:os'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { pickDriver } from './drivers'
import { createFixture } from './fixture'
import { checkHostLoad } from './host-load'
import type { BusyProcess } from './host-load'
import { resolveStacksRuntimeDependencies, resolveStacksSourceModules } from './provenance'
import { startProfileWorker } from './profiler'
import { assertParity, assertStableParity, BENCH_ROOT, benchmarkQueryLoggingEnabled, FIXTURE, headersFor, PORT, REPO_ROOT } from './runtime'
import { SCENARIOS } from './scenarios'
import { readSourceState } from './source'
import { targetById } from './targets'

const { values } = parseArgs({ options: { output: { type: 'string' } }, strict: true })
const startedAt = new Date().toISOString()
const output = resolve(values.output ?? join(BENCH_ROOT, 'results', `profile-${startedAt.replace(/[:.]/g, '-')}`))
mkdirSync(output, { recursive: true })
const busyProcesses = new Map<number, BusyProcess>()
await checkHostLoad(false, busyProcesses)
const driver = await pickDriver('oha')
const meta = {
  kind: 'cpu-profile', publishable: false, startedAt,
  reason: 'Sampling changes execution cost. These captures identify hotspots and are not throughput comparisons.',
  source: await readSourceState(REPO_ROOT),
  runtime: Bun.version, machine: { arch: arch(), platform: platform(), release: release(), cpu: cpus()[0]?.model },
  stacksSourceModules: resolveStacksSourceModules(REPO_ROOT),
  stacksRuntimeDependencies: resolveStacksRuntimeDependencies(REPO_ROOT),
  driver: driver.name, driverVersion: await driver.version(),
  warmupSeconds: 5, loadSeconds: 10, connections: 50, sampleIntervalMicros: 1000,
  persistentQueryLogging: benchmarkQueryLoggingEnabled(),
}
await Bun.write(join(output, 'profile-metadata.json'), `${JSON.stringify(meta, null, 2)}\n`)
createFixture(FIXTURE)

for (const targetId of ['stacks', 'stacks-warm']) {
  const target = targetById(targetId)!
  for (const scenario of SCENARIOS) {
    await checkHostLoad(false, busyProcesses)
    const prefix = `${target.id}--${scenario.id}`
    console.error(`[profile] ${prefix}`)
    const capturePath = join(output, `${prefix}.json`)
    const worker = startProfileWorker(target, scenario, capturePath)
    try {
      await worker.ready()
      const before = await assertParity(target, scenario)
      const request = {
        url: `http://127.0.0.1:${PORT}${scenario.path}`,
        method: scenario.method, body: scenario.body, headers: headersFor(target, scenario),
        connections: meta.connections, warmupSeconds: 0,
      }
      const warmup = await driver.run({ ...request, durationSeconds: meta.warmupSeconds })
      await Bun.write(join(output, `${prefix}--warmup.json`), warmup.raw)
      await worker.start()
      const load = await driver.run({ ...request, durationSeconds: meta.loadSeconds })
      await worker.capture()
      await Bun.write(join(output, `${prefix}--load.json`), load.raw)
      const after = await assertParity(target, scenario)
      assertStableParity(target, scenario, before, after)
      await Bun.write(join(output, `${prefix}--parity.json`), `${JSON.stringify({ before, after }, null, 2)}\n`)
      if (load.requests <= 0 || load.errors !== 0 || warmup.requests <= 0 || warmup.errors !== 0)
        throw new Error(`${prefix} did not complete error-free profile traffic`)
      const capture = await Bun.file(capturePath).json()
      if (!Array.isArray(capture.stackTraces?.traces) || capture.stackTraces.traces.length === 0)
        throw new Error(`${prefix} contains no CPU samples`)
      await Bun.write(join(output, `${prefix}.txt`), `${meta.reason}\n\n${capture.functions}\n${capture.bytecodes}`)
    }
    finally {
      const logs = await worker.close()
      await Bun.write(join(output, `${prefix}--worker.log`), `${logs.stdout}\n${logs.stderr}`)
    }
    await checkHostLoad(false, busyProcesses)
  }
}
await Bun.write(join(output, 'profile-complete.json'), `${JSON.stringify({ sourceAtEnd: await readSourceState(REPO_ROOT), completedAt: new Date().toISOString() }, null, 2)}\n`)
