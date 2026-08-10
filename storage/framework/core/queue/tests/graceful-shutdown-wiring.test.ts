import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// stacksjs/stacks#1984 — the worker runs in a spawned CHILD (buddy queue:work
// → runAction → `bun queue/work.ts`), but only the PARENT installed a
// SIGTERM/SIGINT handler, and its stopProcessor() drained an empty in-process
// state while the child was killed mid-handle() — abandoning in-flight jobs.
// The drain must run in the child. Signal delivery can't be exercised in a unit
// test, so the wiring is pinned as source-shape checks across both processes.

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf-8')

describe('queue worker graceful-shutdown wiring (#1984)', () => {
  describe('child worker entry (actions/src/queue/work.ts) drains on signal', () => {
    const work = read('../../actions/src/queue/work.ts')

    it('imports and calls stopProcessor', () => {
      expect(work).toMatch(/import \{[^}]*stopProcessor[^}]*\} from '@stacksjs\/queue'/)
      expect(work).toContain('await stopProcessor({ graceMs: SHUTDOWN_GRACE_MS })')
    })

    it('installs its own SIGTERM and SIGINT handlers', () => {
      expect(work).toContain(`process.on('SIGTERM'`)
      expect(work).toContain(`process.on('SIGINT'`)
      expect(work).toContain('gracefulShutdown')
    })

    it('has a hard backstop so a wedged handler cannot hold the worker open', () => {
      expect(work).toMatch(/setTimeout\([\s\S]*?process\.exit\(1\)[\s\S]*?SHUTDOWN_GRACE_MS \+ 2_000/)
    })
  })

  describe('parent command (buddy/src/commands/queue.ts) no longer drains empty state', () => {
    const cmd = read('../../buddy/src/commands/queue.ts')
    // the queue:work action body up to the next command
    const workCmd = cmd.slice(cmd.indexOf(`'queue:work'`), cmd.indexOf(`'queue:failed'`))

    it('no longer calls the no-op in-process stopProcessor', () => {
      // the braced call `stopProcessor({ graceMs })` is gone (the comment may
      // still reference `stopProcessor()` when explaining the child's drain)
      expect(workCmd).not.toContain('stopProcessor({')
      expect(workCmd).not.toContain(`import('@stacksjs/queue').then`)
    })

    it('installs signal handlers that wait for the child, with a longer backstop', () => {
      expect(workCmd).toContain(`process.on('SIGINT'`)
      expect(workCmd).toContain(`process.on('SIGTERM'`)
      expect(workCmd).toContain('PARENT_BACKSTOP_MS = SHUTDOWN_GRACE_MS + 5_000')
    })
  })

  // stacksjs/stacks#2282 item 5 — the drain above awaits the `inFlightJobs`
  // set, and ONLY the database path ever added to it. Under the Redis driver
  // the set stayed empty, so the drain had nothing to wait for and returned
  // immediately: a deploy or SIGTERM killed Redis jobs mid-run, while the
  // identical deploy against the database driver waited for them.
  //
  // Pinned as wiring rather than behaviour for the same reason as the rest of
  // this file: proving a job survives a signal needs a live Redis and a real
  // process to kill, neither of which a unit test has. What is checkable is
  // that both drivers register their handler through the same tracker.
  describe('both drivers register their handler with the drain (#2282 item 5)', () => {
    const worker = read('../src/worker.ts')

    it('tracks the redis handler, not just the database one', () => {
      expect(worker).toMatch(/queue\.process\(\s*concurrency\s*,\s*\(?bunJob[^)]*\)?\s*(:\s*any\s*)?=>\s*trackInFlight\(/)
    })

    it('keeps the database path tracked too', () => {
      expect(worker).toContain('await trackInFlight(processJob(job))')
    })

    it('wraps at registration, so a throw still reaches bun-queue retry logic', () => {
      // `trackInFlight` returns the promise it was given. Registering
      // `() => trackInFlight(handler(job))` therefore hands bun-queue the same
      // promise it would have had, rejection included. Swallowing it here
      // (e.g. `.catch(() => {})`) would silently disable Redis retries.
      const registration = worker.slice(worker.indexOf('queue.process(concurrency'))
      expect(registration.slice(0, 200)).not.toContain('.catch(')
    })
  })
})
