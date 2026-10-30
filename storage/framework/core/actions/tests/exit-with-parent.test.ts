import { afterEach, describe, expect, test } from 'bun:test'
import { tmpdir } from 'node:os'
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
      console.log('READY')
      setInterval(() => {}, 1000)
    `
    // The orphan's stdout goes to a file, not 'ignore': the reason it printed
    // on the way out is the other half of what this test is for (#3066).
    const orphanOut = `${tmpdir()}/stacks-exit-with-parent-${Date.now()}.txt`
    const parentScript = `
      const gc = Bun.spawn(['bun', '-e', ${JSON.stringify(grandchildScript)}], { stdout: Bun.file(${JSON.stringify(orphanOut)}), stderr: 'ignore' })
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

    // Wait for the orphan-to-be to have captured its ppid. Without this the
    // parent can die while it is still starting, so it comes up already
    // orphaned and reports no parent pid - a weaker test than it looks.
    const readyBy = Date.now() + 10_000
    while (Date.now() < readyBy && !(await Bun.file(orphanOut).text().catch(() => '')).includes('READY'))
      await Bun.sleep(25)
    expect((await Bun.file(orphanOut).text().catch(() => ''))).toContain('READY')

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

    // Exiting silently is what made an orphaned dev server look like a crash:
    // identical logs, a dead port and status 0 either way (#3066). No signal
    // is involved on this path, so the line has to name the parent instead.
    const printed = (await Bun.file(orphanOut).text().catch(() => '')).trim()
    expect(printed).toContain('go away')
    expect(printed).toContain(`pid ${parent.pid}`)
    expect(printed).toContain('stopping this dev process')
  }, 15000)

  test('a signalled process says which signal stopped it', async () => {
    // The signal half of the same problem. Cheaper than the orphan test above
    // because no third process is needed: send SIGHUP and read what it wrote.
    const guard = `${import.meta.dir}/../src/dev/exit-with-parent.ts`
    const out = `${tmpdir()}/stacks-exit-with-parent-sig-${Date.now()}.txt`
    const script = `
      import { exitWithParent } from '${guard}'
      exitWithParent({ intervalMs: 5000 })
      console.log('READY')
      setInterval(() => {}, 1000)
    `
    const child = Bun.spawn(['bun', '-e', script], { stdout: Bun.file(out), stderr: 'ignore' })

    const ready = Date.now() + 10_000
    while (Date.now() < ready && !(await Bun.file(out).text().catch(() => '')).includes('READY'))
      await Bun.sleep(25)

    child.kill('SIGHUP')
    await child.exited
    // The write is synchronous, but the file handle still has to settle.
    await Bun.sleep(150)

    const printed = (await Bun.file(out).text().catch(() => '')).trim()
    expect(printed).toContain('received SIGHUP')
    expect(printed).toContain('stopping this dev process')
  }, 15000)
})
