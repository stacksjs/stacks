/**
 * bootAppListeners: once per process, and never silent.
 *
 * A process that dispatches events without registering the application's
 * listeners looks exactly like one where nothing was listening. StatusHQ's
 * scheduler did that for two weeks: every incident it opened notified nobody
 * and no line in any log said so. These pin the two ways that is now said -
 * at startup when declared listeners could not be registered, and on the first
 * dispatch in a process that never booted - and that booting twice (a process
 * that goes through two entry points) still delivers each event once.
 *
 * The dispatch check is per process, so those cases run in a child process.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const EVENTS = resolve(import.meta.dir, '../src/index.ts')
const WARNING = 'never registered the application\'s listeners'

let root: string

function app(events: Record<string, string[]>, listeners: Record<string, string> = {}): void {
  mkdirSync(join(root, 'app', 'Listeners'), { recursive: true })
  writeFileSync(join(root, 'app', 'Events.ts'), `export default ${JSON.stringify(events)}\n`)
  for (const [name, body] of Object.entries(listeners))
    writeFileSync(join(root, 'app', 'Listeners', `${name}.ts`), body)
}

async function runChild(script: string): Promise<{ code: number, stdout: string, stderr: string }> {
  const file = join(root, 'child.ts')
  writeFileSync(file, script)
  const child = Bun.spawn([process.execPath, file], { cwd: root, env: { ...process.env }, stdout: 'pipe', stderr: 'pipe' })
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  return { code, stdout, stderr }
}

const counter = `
import { appendFileSync } from 'node:fs'
export default { handle() { appendFileSync(${JSON.stringify('__MARKER__')}, 'x') } }
`

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'stacks-events-boot-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('the first dispatch in a process that never booted', () => {
  test('warns once, naming the event and what to call', async () => {
    app({ 'boot-test:fired': ['Nobody'] })

    const { code, stderr } = await runChild(`
      const { dispatch } = await import(${JSON.stringify(EVENTS)})
      dispatch('boot-test:fired', {})
      dispatch('boot-test:fired', {})
      dispatch('boot-test:other', {})
      await Bun.sleep(300)
    `)

    expect(code).toBe(0)
    expect(stderr.split(WARNING).length - 1).toBe(1)
    expect(stderr).toContain('"boot-test:fired" was dispatched')
    expect(stderr).toContain('app/Events.ts declares 1')
    expect(stderr).toContain('injectGlobalAutoImports()')
  }, 30_000)

  test('says nothing when the application declares no listeners', async () => {
    app({})

    const { stderr } = await runChild(`
      const { dispatch } = await import(${JSON.stringify(EVENTS)})
      dispatch('boot-test:fired', {})
      await Bun.sleep(300)
    `)

    expect(stderr).not.toContain(WARNING)
  }, 30_000)

  test('says nothing in a process that booted first', async () => {
    const marker = join(root, 'count.log')
    app({ 'boot-test:fired': ['Counter'] }, { Counter: counter.replace('__MARKER__', marker) })

    const { stderr } = await runChild(`
      const { bootAppListeners, dispatch } = await import(${JSON.stringify(EVENTS)})
      await bootAppListeners({ log: { info: () => {} } })
      dispatch('boot-test:fired', {})
      await Bun.sleep(300)
    `)

    expect(stderr).not.toContain(WARNING)
  }, 30_000)
})

describe('bootAppListeners', () => {
  test('registers once per process, however many entry points call it', async () => {
    const marker = join(root, 'count.log')
    app({ 'boot-test:fired': ['Counter'] }, { Counter: counter.replace('__MARKER__', marker) })

    const { code, stdout, stderr } = await runChild(`
      import { readFileSync } from 'node:fs'
      const { bootAppListeners, registerAppListeners, dispatch } = await import(${JSON.stringify(EVENTS)})
      const quiet = { log: { info: () => {} } }
      const [first, second] = await Promise.all([bootAppListeners(quiet), bootAppListeners(quiet)])
      const third = await bootAppListeners(quiet)
      // A caller that still registers directly is deduplicated too.
      const direct = await registerAppListeners(quiet)
      dispatch('boot-test:fired', {})
      await Bun.sleep(200)
      console.log(JSON.stringify({ first, second, third, direct, deliveries: readFileSync(${JSON.stringify(marker)}, 'utf8').length }))
    `)

    expect(code, stderr).toBe(0)
    expect(JSON.parse(stdout.trim().split('\n').pop()!)).toEqual({ first: 1, second: 1, third: 1, direct: 0, deliveries: 1 })
  }, 30_000)

  test('warns at startup when the application declares listeners and none could be registered', async () => {
    app({ 'boot-test:fired': ['DoesNotExist'], 'boot-test:other': ['AlsoMissing'] })

    const { stderr } = await runChild(`
      const { bootAppListeners } = await import(${JSON.stringify(EVENTS)})
      await bootAppListeners()
    `)

    expect(stderr).toContain('app/Events.ts declares 2 listeners, but none could be registered in this process')
  }, 30_000)
})
