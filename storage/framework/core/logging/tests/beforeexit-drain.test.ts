/**
 * Draining on a natural exit must not keep the process alive.
 *
 * `registerFlushOnExit` hooks `beforeExit` and calls the async `log.flush()`.
 * A `beforeExit` listener that schedules real event-loop work gets
 * `beforeExit` emitted AGAIN when the loop next empties, and `flush()`
 * schedules exactly that as soon as a transport or an error reporter does I/O.
 * Registered with `on`, the two never settled: every process that reached a
 * natural exit spun on the handler instead of exiting.
 *
 * `buddy typecheck` was the one that surfaced it (stacksjs/stacks#2868). It
 * completed the typecheck, logged that it finished, and then stayed alive
 * indefinitely, orphaned to PID 1 when its shell died, so anything reading it
 * through a pipe never saw EOF and the GitHub Actions step ran to its timeout
 * and was reported as cancelled. The ~180 buddy commands that end in an
 * explicit `process.exit` were immune, because that skips `beforeExit`
 * altogether, which is why the fix had been applied one command at a time.
 *
 * Both halves matter, so both are asserted: the process has to exit, and it
 * still has to drain before it does.
 */

import { describe, expect, it } from 'bun:test'
import { join, resolve } from 'node:path'
import process from 'node:process'

const repositoryRoot = resolve(import.meta.dir, '../../../../..')
// An empty bunfig, so the app's own preloads stay out of the measurement.
const config = join(repositoryRoot, 'bench/startup/bunfig.toml')
const fixture = join(import.meta.dir, 'fixtures/beforeexit-probe.ts')

async function runFixture(timeoutMs: number): Promise<{ exitCode: number | null, killed: boolean, stdout: string }> {
  const env = { ...process.env, LOG_WRITE_TO_FILE: 'false' }
  delete env.LOG_LEVEL

  const child = Bun.spawn([
    process.execPath,
    '--no-env-file',
    `--config=${config}`,
    fixture,
  ], { cwd: repositoryRoot, env, stdout: 'pipe', stderr: 'pipe' })

  let killed = false
  const timer = setTimeout(() => {
    killed = true
    child.kill(9)
  }, timeoutMs)

  const exitCode = await child.exited
  clearTimeout(timer)

  return { exitCode, killed, stdout: await new Response(child.stdout).text() }
}

describe('draining on a natural exit', () => {
  it('lets the process exit instead of re-arming beforeExit', async () => {
    const { exitCode, killed, stdout } = await runFixture(10_000)

    // `killed` is the regression: it means the fixture was still running when
    // the timeout fired, which is the hang itself rather than a slow machine.
    expect(killed).toBe(false)
    expect(exitCode).toBe(0)
    expect(stdout).toContain('flushed')
  }, 20_000)

  it('still drains the transport before going', async () => {
    const { stdout } = await runFixture(10_000)

    // Exiting promptly is worthless if it truncates the output the hook
    // exists to save, so the fixture reports whether its flush completed.
    expect(stdout).toContain('{"flushed":true}')
  }, 20_000)
})
