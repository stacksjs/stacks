// One emitter per process, not one per copy of this package.
//
// The failure this pins is silent in the worst way. A module-level emitter is a
// singleton of the module, and a module is only a singleton if exactly one copy
// of it is installed - which is not the case in any app that depends on
// `@stacksjs/events` alongside `stacks` or `@stacksjs/buddy`, each carrying its
// own range. Bun hoists one and nests the others.
//
// Nothing then errors. The boot that registers listeners imports one copy, the
// code that dispatches imports another, and the dispatch returns normally
// having reached nobody - indistinguishable from an event nobody subscribed to.
//
// The tests below construct that situation deliberately, because it is easy to
// believe you have hit it when you have not: a probe script loaded from outside
// an application's resolution root produces the same silence, and that one is
// the probe's fault. This pins the property that makes both harmless.

import { afterAll, describe, expect, test } from 'bun:test'
import { copyFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dispatch, emitter, listen } from '../src'

const here = dirname(fileURLToPath(import.meta.url))
const sourceDir = join(here, '..', 'src')

/**
 * A second copy of this module, the way an install produces one.
 *
 * Copied to a second path rather than re-imported with a query string: bun's
 * module cache is keyed by resolved path and normalises the query away, so
 * `import('./index.ts?copy')` hands back the very module this file already
 * holds and the test proves nothing. The copy lives beside the original so its
 * own relative imports still resolve.
 */
const copyPath = join(sourceDir, '__second-copy.ts')
copyFileSync(join(sourceDir, 'index.ts'), copyPath)

afterAll(() => {
  try { rmSync(copyPath, { force: true }) }
  catch { /* left behind is harmless; it is gitignored by name */ }
})

describe('the emitter is shared across copies of this module', () => {
  test('a second import of the source reaches listeners registered by the first', async () => {
    const second: any = await import(copyPath)
    const first: any = await import('../src')

    // Two module instances - the whole premise - and one emitter between them,
    // which is the fix. Before it, these were two emitters and the dispatch
    // below reached nobody while returning perfectly normally.
    expect(second).not.toBe(first)
    expect(second.emitter).toBe(emitter)

    let heard: unknown = null
    listen('copy:probe' as any, (payload: any) => { heard = payload })

    second.dispatch('copy:probe', { from: 'the other copy' })

    expect(heard).toEqual({ from: 'the other copy' })
  })

  test('and the other direction, so neither copy is privileged', async () => {
    const second: any = await import(copyPath)

    let heard: unknown = null
    second.listen('copy:probe-back', (payload: any) => { heard = payload })

    dispatch('copy:probe-back' as any, { from: 'the first copy' } as any)

    expect(heard).toEqual({ from: 'the first copy' })
  })

  test('the shared slot is a Symbol.for, so no copy can shadow another', async () => {
    // Keyed rather than named: a string property could be overwritten by
    // anything, and a `Symbol()` would be a different symbol per copy - which
    // is the bug again, one layer down.
    const slot = Symbol.for('stacks.events.emitter')

    expect((globalThis as any)[slot]).toBe(emitter)
  })
})
