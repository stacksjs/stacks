// Boot-time listener registration, from both conventions at once.
//
// The defect these pin: `app/Events.ts` was read by nothing at runtime and
// `discoverListeners` was exported and never called, so an application that
// followed either convention had an emitter with no handlers on it. `dispatch`
// returned normally, every listener file looked implemented, and the only
// symptom was that nothing happened - notifications, webhooks and activity
// feeds all silently doing nothing for as long as nobody checked.
//
// So these assert registration *and* that a handler actually runs, because
// "registered" was never the part that was broken.

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { discoverListeners, registerAppListeners, resetListenerRegistry } from '../src/discover'
import { dispatch } from '../src/index'

interface Fired { event: string, payload: unknown }

declare global {
  // eslint-disable-next-line vars-on-top, no-var
  var __register_test_fired: Fired[] | undefined
}

let root: string
let counter = 0

/**
 * A different event name in every test.
 *
 * The emitter is a process-wide singleton and these tests register real
 * handlers on it, so a shared name would have each test fire its predecessors'
 * listeners too - and what is being asserted here is a count.
 */
let topic: string
let other: string

const quiet = { warn: () => {}, error: () => {}, info: () => {} }

beforeEach(() => {
  counter += 1
  // A fresh directory per test: bun's module cache is keyed by absolute path,
  // so a reused one serves the previous test's listener file.
  root = join(tmpdir(), `stacks-events-register-${Date.now()}-${counter}`)
  topic = `thing:happened:${counter}`
  other = `thing:else:${counter}`
  mkdirSync(join(root, 'app', 'Listeners'), { recursive: true })
  mkdirSync(join(root, 'app', 'Actions'), { recursive: true })
  globalThis.__register_test_fired = []
  resetListenerRegistry()
})

afterEach(() => {
  try {
    rmSync(root, { recursive: true, force: true })
  }
  catch {
    // ignore cleanup errors
  }
})

/** A listener file that records what it was called with. */
function writeListener(directory: string, name: string, listensTo: string): void {
  writeFileSync(join(root, 'app', directory, `${name}.ts`), `
    export default {
      ${listensTo}
      handle: (payload, event) => {
        globalThis.__register_test_fired.push({ event, payload })
      },
    }
  `)
}

function writeEventMap(entries: Record<string, string[]>): void {
  writeFileSync(join(root, 'app', 'Events.ts'), `export default ${JSON.stringify(entries)}`)
}

function fired(): Fired[] {
  return globalThis.__register_test_fired ?? []
}

describe('registerAppListeners', () => {
  test('registers what app/Events.ts names, and the listener runs', async () => {
    writeListener('Listeners', 'Record', '')
    writeEventMap({ [topic]: ['Record'] })

    expect(await registerAppListeners({ base: root, log: quiet })).toBe(1)

    dispatch(topic as never, { id: 7 } as never)
    expect(fired()).toEqual([{ event: topic, payload: { id: 7 } }])
  })

  test('resolves a name to an action when there is no listener by that name', async () => {
    // The framework's own default `app/Events.ts` names actions, so refusing
    // them would leave the shipped configuration pointing at nothing.
    writeListener('Actions', 'SendWelcome', '')
    writeEventMap({ [topic]: ['SendWelcome'] })

    expect(await registerAppListeners({ base: root, log: quiet })).toBe(1)

    dispatch(topic as never, { id: 1 } as never)
    expect(fired().length).toBe(1)
  })

  test('one listener over several events is told which one fired', async () => {
    // Without the event name, a listener handling a family of events has to be
    // told by whoever emitted it - which every emitter then has to remember,
    // and one of them will not.
    writeListener('Listeners', 'Audit', `listensTo: ${JSON.stringify([topic, other])},`)

    expect(await registerAppListeners({ base: root, log: quiet })).toBe(2)

    dispatch(topic as never, {} as never)
    dispatch(other as never, {} as never)

    expect(fired().map(entry => entry.event)).toEqual([topic, other])
  })

  test('a listener named in the map AND declaring listensTo runs once', async () => {
    /*
     * The reason the registry exists. A double-written audit row is worse than
     * a missing one: two rows read as two events, and the log people reach for
     * after something went wrong is the last place to invent history.
     */
    writeListener('Listeners', 'Both', `listensTo: ${JSON.stringify(topic)},`)
    writeEventMap({ [topic]: ['Both'] })

    expect(await registerAppListeners({ base: root, log: quiet })).toBe(1)

    dispatch(topic as never, {} as never)
    expect(fired().length).toBe(1)
  })

  test('registering twice does not double up', async () => {
    // A dev server re-runs boot on reload, and a doubled handler would survive
    // until the process restarted.
    writeListener('Listeners', 'Once', `listensTo: ${JSON.stringify(topic)},`)

    await registerAppListeners({ base: root, log: quiet })
    expect(await registerAppListeners({ base: root, log: quiet })).toBe(0)

    dispatch(topic as never, {} as never)
    expect(fired().length).toBe(1)
  })

  test('a name that resolves to nothing is warned about, not swallowed', async () => {
    // Somebody believes that listener is running. Silence here is the whole
    // defect this file is about, one entry at a time.
    const warnings: string[] = []
    writeEventMap({ [topic]: ['Missing'] })

    const count = await registerAppListeners({
      base: root,
      log: { ...quiet, warn: (message: string) => warnings.push(message) },
    })

    expect(count).toBe(0)
    expect(warnings.some(message => message.includes('Missing'))).toBe(true)
  })

  test('a listener that throws on import does not stop the others', async () => {
    writeFileSync(join(root, 'app', 'Listeners', 'Broken.ts'), `throw new Error('boom')`)
    writeListener('Listeners', 'Fine', `listensTo: ${JSON.stringify(topic)},`)

    expect(await registerAppListeners({ base: root, log: quiet })).toBe(1)
  })

  test('no app/Events.ts is not an error', async () => {
    writeListener('Listeners', 'Alone', `listensTo: ${JSON.stringify(topic)},`)

    expect(await registerAppListeners({ base: root, log: quiet })).toBe(1)
  })
})

describe('discoverListeners with an array', () => {
  test('an array listensTo registers every event in it', async () => {
    // This shape used to fail the module check and be skipped with a warning
    // at boot, which is how a listener over eight events came to be registered
    // for none of them.
    writeListener('Listeners', 'Many', `listensTo: ${JSON.stringify([topic, other, `${topic}:third`])},`)

    expect(await discoverListeners({ dir: join(root, 'app', 'Listeners'), log: quiet })).toBe(3)
  })
})
