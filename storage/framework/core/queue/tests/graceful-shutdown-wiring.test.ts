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
})
