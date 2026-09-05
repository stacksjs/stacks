import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

if (process.argv[2] !== 'check') {
  // Bound the regression on the old runner, including an ignored SIGTERM.
  setTimeout(() => process.exit(1), 10_000).unref()
  process.on('SIGTERM', () => {})
  writeFileSync(process.env.BENCH_PID_FILE!, String(process.pid))
  if (process.env.BENCH_STARTUP_FAILURE === 'config-exit') {
    console.error('fixture dependency is unavailable')
    process.exit(78)
  }
  Bun.serve({
    port: Number(process.env.BENCH_PORT),
    fetch() {
      writeFileSync(process.env.BENCH_PROBE_FILE!, 'seen')
      if (process.env.BENCH_STARTUP_FAILURE === 'unavailable')
        return new Response('starting', { status: 503 })
      if (process.env.BENCH_STARTUP_FAILURE === 'hang-body') {
        return new Response(new ReadableStream({
          start(controller) { controller.enqueue(new Uint8Array([1])) },
        }))
      }
      return new Promise<Response>(() => {})
    },
  })
}
else {
  const { boot, stop } = await import('../runtime')
  const directory = mkdtempSync(join(tmpdir(), 'stacks-benchmark-startup-'))
  const pidFile = join(directory, 'pid')
  const probeFile = join(directory, 'probe')
  const mode = process.argv[3]!
  const target = {
    id: 'startup-failure',
    label: 'startup-failure',
    server: '../fixtures/startup-failure.ts',
    env: { BENCH_PID_FILE: pidFile, BENCH_PROBE_FILE: probeFile, BENCH_STARTUP_FAILURE: mode },
  }
  const alive = (pid: number): boolean => {
    try { process.kill(pid, 0); return true }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false
      throw error
    }
  }
  const readPid = (): number | undefined => {
    if (!existsSync(pidFile)) return
    const pid = Number(readFileSync(pidFile, 'utf8'))
    if (!Number.isInteger(pid) || pid <= 0) throw new Error('Invalid fixture PID')
    return pid
  }
  try {
    const start = performance.now()
    let failure: unknown
    let skipped: string | undefined
    try {
      const server = await boot(target, false, undefined, 1000)
      if ('skipped' in server) skipped = server.skipped
      else await stop(server)
    }
    catch (error) { failure = error }
    if (mode === 'config-exit') {
      if (skipped !== 'fixture dependency is unavailable') throw new Error('Missing dependency was not skipped')
    }
    else if (!(failure instanceof Error) || !failure.message.includes('did not become ready within 1s')) {
      throw new Error(`Expected the readiness deadline, got ${String(failure)}`)
    }
    if (performance.now() - start > 5000) throw new Error('Readiness deadline was not bounded')
    if (mode !== 'config-exit' && !existsSync(probeFile)) throw new Error('The stalled server was never probed')
    const pid = readPid()
    if (pid === undefined || alive(pid)) throw new Error('Failed startup left its server alive')
    await Bun.write(Bun.stdout, 'benchmark-startup-cleanup-ok\n')
  }
  finally {
    const pid = readPid()
    if (pid !== undefined && alive(pid)) process.kill(pid, 'SIGKILL')
    rmSync(directory, { recursive: true, force: true })
  }
}
