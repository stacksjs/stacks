import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { discoverListeners } from '../src/discover'
import { dispatch } from '../src/index'

// stacksjs/stacks#1878 E-3 — pins the auto-discovery contract:
// scan a directory, import each file, register the default-exported
// listener if it matches { listensTo, handle }. Malformed exports
// log + skip. Errors during import log + skip.

describe('discoverListeners (stacksjs/stacks#1878 E-3)', () => {
  const testRoot = join(tmpdir(), `stacks-events-discover-${Date.now()}`)

  beforeEach(() => {
    mkdirSync(testRoot, { recursive: true })
  })

  afterEach(() => {
    try {
      rmSync(testRoot, { recursive: true, force: true })
    }
    catch {
      // ignore cleanup errors
    }
  })

  test('returns 0 when the listeners directory does not exist', async () => {
    const count = await discoverListeners({ dir: join(testRoot, 'does-not-exist') })
    expect(count).toBe(0)
  })

  test('returns 0 for an empty directory', async () => {
    const count = await discoverListeners({ dir: testRoot })
    expect(count).toBe(0)
  })

  test('registers a default-exported listener and dispatches to it', async () => {
    const fired: unknown[] = []
    // Stash the handler on globalThis so the spawned module can find it.
    ;(globalThis as { __discover_test_handler?: (e: unknown) => void }).__discover_test_handler = (e) => {
      fired.push(e)
    }

    writeFileSync(join(testRoot, 'TestListener.ts'), `
      export default {
        listensTo: 'test:event:e3-basic',
        handle: (event) => {
          // @ts-ignore - test-only global
          globalThis.__discover_test_handler?.(event)
        },
      }
    `)

    const count = await discoverListeners({ dir: testRoot })
    expect(count).toBe(1)

    dispatch('test:event:e3-basic' as never, { payload: 42 } as never)
    expect(fired).toEqual([{ payload: 42 }])

    delete (globalThis as { __discover_test_handler?: unknown }).__discover_test_handler
  })

  test('skips files whose default export does not match the listener shape', async () => {
    writeFileSync(join(testRoot, 'NotAListener.ts'), `
      export default { somethingElse: true }
    `)
    writeFileSync(join(testRoot, 'ValidListener.ts'), `
      export default {
        listensTo: 'test:event:e3-mixed',
        handle: () => {},
      }
    `)

    const warned: string[] = []
    const count = await discoverListeners({
      dir: testRoot,
      log: { warn: m => warned.push(m), info: () => {}, error: () => {} },
    })

    expect(count).toBe(1)
    expect(warned.some(w => w.includes('NotAListener.ts'))).toBe(true)
  })

  test('continues discovery when one file throws during import', async () => {
    writeFileSync(join(testRoot, 'Broken.ts'), `
      throw new Error('boom at module-eval')
    `)
    writeFileSync(join(testRoot, 'Good.ts'), `
      export default {
        listensTo: 'test:event:e3-good',
        handle: () => {},
      }
    `)

    const errors: string[] = []
    const count = await discoverListeners({
      dir: testRoot,
      log: { error: m => errors.push(m), warn: () => {}, info: () => {} },
    })

    expect(count).toBe(1)
    expect(errors.some(e => e.includes('Broken.ts'))).toBe(true)
  })

  test('recursively walks subdirectories', async () => {
    mkdirSync(join(testRoot, 'subgroup'), { recursive: true })
    writeFileSync(join(testRoot, 'subgroup', 'NestedListener.ts'), `
      export default {
        listensTo: 'test:event:e3-nested',
        handle: () => {},
      }
    `)

    const count = await discoverListeners({ dir: testRoot })
    expect(count).toBe(1)
  })

  test('honors the extensions filter', async () => {
    writeFileSync(join(testRoot, 'ListenerA.ts'), `
      export default { listensTo: 'test:event:e3-ext-ts', handle: () => {} }
    `)
    writeFileSync(join(testRoot, 'ListenerB.txt'), `
      // not a JS/TS file — should be ignored even though it has a default export
    `)

    const count = await discoverListeners({ dir: testRoot, extensions: ['.ts'] })
    expect(count).toBe(1)
  })
})
