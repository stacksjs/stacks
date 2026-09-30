/**
 * The long-running entry points register the application's listeners.
 *
 * Only the HTTP server used to. The scheduler (`buddy schedule:run`, which runs
 * actions/src/schedule/run.ts) and the queue worker (`buddy queue:work`, which
 * runs actions/src/queue/work.ts) went straight to application code, so every
 * event dispatched there reached an emitter with nothing on it. StatusHQ opens
 * and resolves incidents from a scheduled job and routes `incident:created` to
 * its notifier in app/Events.ts: for as long as that was true, no incident
 * notified anyone, and nothing logged a word about it.
 *
 * The scheduler is exercised for real: its entry file is spawned in a fixture
 * application whose app/Scheduler.ts dispatches an event, and the listener
 * app/Events.ts maps to it has to receive that event exactly once.
 */

import { describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const SRC = resolve(import.meta.dir, '../src')
const EVENTS = resolve(import.meta.dir, '../../events/src/index.ts')

function fixtureApp(): { root: string, marker: string } {
  // Not under a directory named `storage`: path.projectPath() walks up out of
  // one, which would resolve this fixture's app/ to somewhere else entirely.
  const root = mkdtempSync(join(tmpdir(), 'stacks-entry-boot-'))
  const marker = join(root, 'fired.log')
  mkdirSync(join(root, 'app', 'Listeners'), { recursive: true })

  writeFileSync(join(root, 'app', 'Events.ts'), `export default { 'entry-probe:fired': ['EntryProbe'] }\n`)
  writeFileSync(join(root, 'app', 'Listeners', 'EntryProbe.ts'), [
    `import { appendFileSync } from 'node:fs'`,
    `export default {`,
    `  handle(payload: unknown) {`,
    `    appendFileSync(${JSON.stringify(marker)}, JSON.stringify(payload) + '\\n')`,
    `  },`,
    `}`,
    ``,
  ].join('\n'))
  // runScheduler() calls this default export once at startup, as a real
  // app/Scheduler.ts is called to declare its schedule. Dispatching from it is
  // what a scheduled job's model save does.
  writeFileSync(join(root, 'app', 'Scheduler.ts'), [
    `export default function () {`,
    `  void import(${JSON.stringify(EVENTS)}).then(({ dispatch }) => dispatch('entry-probe:fired', { from: 'scheduler' }))`,
    `}`,
    ``,
  ].join('\n'))

  return { root, marker }
}

async function waitFor(check: () => boolean, timeoutMs: number): Promise<boolean> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (check())
      return true
    await Bun.sleep(100)
  }
  return check()
}

describe('the scheduler entry registers the application\'s listeners', () => {
  test('an event dispatched in the scheduler process reaches the listener app/Events.ts maps it to, once', async () => {
    const { root, marker } = fixtureApp()
    const child = Bun.spawn([process.execPath, join(SRC, 'schedule', 'run.ts')], {
      cwd: root,
      env: { ...process.env, APP_ENV: 'test', STACKS_ORM_EVENT_ERRORS: 'swallow' },
      stdout: 'pipe',
      stderr: 'pipe',
    })

    try {
      const fired = await waitFor(() => existsSync(marker), 45_000)
      // Long enough for a second delivery to land, were the listener
      // registered twice.
      await Bun.sleep(500)
      child.kill()
      const [stdout, stderr] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text()])

      expect(fired, `the listener never ran.\nstdout:\n${stdout}\nstderr:\n${stderr}`).toBe(true)
      expect(readFileSync(marker, 'utf8').trim().split('\n')).toEqual([JSON.stringify({ from: 'scheduler' })])
      expect(`${stdout}\n${stderr}`).not.toContain('never registered the application\'s listeners')
    }
    finally {
      child.kill()
      rmSync(root, { recursive: true, force: true })
    }
  }, 60_000)
})

describe('the queue worker entry registers the application\'s listeners', () => {
  // The worker only reaches application code through a job pulled from a
  // real queue backend, so its boot is pinned at the source: the same call the
  // scheduler test above proves sufficient, made before the first job can be
  // taken.
  test('work.ts boots the application before it starts taking jobs', () => {
    const source = readFileSync(join(SRC, 'queue', 'work.ts'), 'utf8')
    const boot = source.indexOf('await injectGlobalAutoImports()')
    const start = source.indexOf('await startProcessor(')

    expect(boot).toBeGreaterThan(-1)
    expect(start).toBeGreaterThan(-1)
    expect(boot).toBeLessThan(start)
  })
})
