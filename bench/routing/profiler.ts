import type { Scenario } from './scenarios'
import type { Target } from './targets'
import { REPO_ROOT, serverCommand, serverEnvironment } from './runtime'

/** Profile a real HTTP server without including boot, warm-up, or the load generator. */
export function startProfileWorker(target: Target, scenario: Scenario, output: string, timeoutMs = 60_000) {
  if (target.server !== 'stacks.ts')
    throw new Error('CPU profiling currently supports the Stacks fixture only')
  const signals = {
    ready: Promise.withResolvers<void>(),
    started: Promise.withResolvers<void>(),
    captured: Promise.withResolvers<void>(),
  }
  const proc = Bun.spawn(serverCommand('../fixtures/profile-worker.ts'), {
    cwd: REPO_ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...serverEnvironment(target, scenario.requiresDb === true, scenario.id), BENCH_PROFILE_OUTPUT: output },
    ipc(message: unknown) {
      if (message === 'ready' || message === 'started' || message === 'captured')
        signals[message].resolve()
    },
  })
  // Drain both pipes throughout the capture so logging cannot fill a pipe and
  // stall request handling. Return the logs with the profile for diagnosis.
  const stdout = new Response(proc.stdout).text()
  const stderr = new Response(proc.stderr).text()
  const exited = proc.exited.then(async code => new Error(`CPU profiling worker exited ${code}: ${(await stderr).trim()}`))
  async function waitFor(signal: keyof typeof signals): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const deadline = Promise.withResolvers<never>()
      timer = setTimeout(() => deadline.reject(new Error(`CPU profiling worker did not signal ${signal} within ${timeoutMs}ms`)), timeoutMs)
      const result = await Promise.race([
        signals[signal].promise,
        exited,
        deadline.promise,
      ])
      if (result instanceof Error)
        throw result
    }
    finally {
      clearTimeout(timer)
    }
  }
  return {
    pid: proc.pid,
    ready: () => waitFor('ready'),
    async start() {
      proc.send('start')
      await waitFor('started')
    },
    async capture() {
      proc.send('stop')
      await waitFor('captured')
    },
    async close() {
      if (proc.exitCode == null) proc.kill('SIGKILL')
      const exitCode = await proc.exited
      return { exitCode, stdout: await stdout, stderr: await stderr }
    },
  }
}
