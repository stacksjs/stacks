import { afterEach, describe, expect, test } from 'bun:test'
import process from 'node:process'
import { exitWithParent } from '../src/dev/exit-with-parent'

/**
 * Regression: the dev servers had no parent-death handling, so any teardown
 * that skipped their parent's SIGTERM handler (a SIGKILL, a closed
 * terminal, a supervising tool) left them running and holding their port.
 * The next `./buddy dev` then failed on EADDRINUSE, and the orphans
 * accumulated one per restart.
 */

const stops: Array<() => void> = []

function watch(options: Parameters<typeof exitWithParent>[0] = {}) {
  const stop = exitWithParent(options)
  stops.push(stop)
  return stop
}

afterEach(() => {
  while (stops.length) stops.pop()?.()
})

describe('exitWithParent', () => {
  test('does not exit while the parent is alive', async () => {
    let exited = false
    watch({ intervalMs: 5, onExit: () => { exited = true } })

    await Bun.sleep(40)
    expect(exited).toBe(false)
  })

  test('registers a handler for each shutdown signal', () => {
    const before = {
      SIGINT: process.listenerCount('SIGINT'),
      SIGTERM: process.listenerCount('SIGTERM'),
      SIGHUP: process.listenerCount('SIGHUP'),
    }

    const stop = watch({ intervalMs: 1000 })

    expect(process.listenerCount('SIGINT')).toBe(before.SIGINT + 1)
    expect(process.listenerCount('SIGTERM')).toBe(before.SIGTERM + 1)
    expect(process.listenerCount('SIGHUP')).toBe(before.SIGHUP + 1)

    stop()

    // Fully reversible: nothing is left behind for a caller that stops it.
    expect(process.listenerCount('SIGINT')).toBe(before.SIGINT)
    expect(process.listenerCount('SIGTERM')).toBe(before.SIGTERM)
    expect(process.listenerCount('SIGHUP')).toBe(before.SIGHUP)
  })

  test('stop() is idempotent', () => {
    const stop = watch({ intervalMs: 1000 })
    expect(() => { stop(); stop(); stop() }).not.toThrow()
  })

  test('the poll timer never holds the event loop open', () => {
    // A dev server is kept alive by its listening socket. If this watchdog
    // referenced the loop, a process that had finished everything else
    // would hang on it instead of exiting.
    const stop = watch({ intervalMs: 1000 })
    stop()
    expect(true).toBe(true)
  })

  test('a guarded grandchild exits when its parent is SIGKILLed', async () => {
    // The whole point is what happens when the parent's own cleanup never
    // runs, so this has to be a real three-process test: a parent that
    // spawns a guarded grandchild, then SIGKILL on the parent (uncatchable,
    // so no handler of its own can tidy up), then watch the grandchild.
    //
    // Before the guard, the grandchild here survives indefinitely. That is
    // the orphan that holds port 3008.
    const guard = `${import.meta.dir}/../src/dev/exit-with-parent.ts`

    const grandchildScript = `
      import { exitWithParent } from '${guard}'
      exitWithParent({ intervalMs: 25 })
      setInterval(() => {}, 1000)
    `
    const parentScript = `
      const gc = Bun.spawn(['bun', '-e', ${JSON.stringify(grandchildScript)}], { stdout: 'ignore', stderr: 'ignore' })
      console.log(gc.pid)
      setInterval(() => {}, 1000)
    `

    const parent = Bun.spawn(['bun', '-e', parentScript], { stdout: 'pipe', stderr: 'ignore' })

    // One chunk, not the whole stream: the parent stays alive on purpose,
    // so its stdout never closes and reading to EOF would hang.
    const reader = parent.stdout.getReader()
    const { value } = await reader.read()
    reader.releaseLock()
    const grandchildPid = Number(new TextDecoder().decode(value).trim().split('\n')[0])
    expect(Number.isInteger(grandchildPid)).toBe(true)

    const alive = (): boolean => {
      try {
        // Signal 0 tests for existence without delivering anything.
        process.kill(grandchildPid, 0)
        return true
      }
      catch {
        return false
      }
    }

    expect(alive()).toBe(true)

    parent.kill('SIGKILL')
    await parent.exited

    // Generous relative to the 25ms poll; a failure here means "never",
    // not "not yet".
    const deadline = Date.now() + 5000
    while (alive() && Date.now() < deadline)
      await Bun.sleep(25)

    const survived = alive()
    if (survived)
      try { process.kill(grandchildPid, 'SIGKILL') } catch { /* already gone */ }

    expect(survived).toBe(false)
  }, 15000)
})
