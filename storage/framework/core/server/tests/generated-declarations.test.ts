/**
 * The generated declarations have to describe the runtime, and only one of them
 * can be read.
 *
 * Both halves of that were broken, and both were invisible:
 *
 *  - `types/auto-imports.d.ts` declared 36 globals that do not exist. Not stale
 *    in the ordinary sense - fiction. `slug`, `camelCase`, `validate`, and nine
 *    models from a completely different application. `slug('x')` type-checked
 *    and threw `slug is not defined`. It survived because `skipLibCheck` is on:
 *    the file was included in both projects and never checked, so its own
 *    imports of directories that do not exist cost nothing, while its
 *    `declare global` block still contributed every name.
 *
 *  - `types/` held two `.ts`/`.d.ts` pairs - `events` and `attributes` - and
 *    TypeScript resolves the `.ts` first. Editing the `.d.ts` was editing a
 *    file nothing reads, which is how two copies of one interface drifted
 *    apart with neither side wrong on its own terms.
 *
 * A declaration that nothing checks is believed by everything, so these are the
 * checks.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'bun:test'
import { path } from '@stacksjs/path'

const typesDir = path.storagePath('framework/types')

describe('no declaration shadows another', () => {
  it('has no file that exists as both .ts and .d.ts', () => {
    /*
     * `foo.ts` and `foo.d.ts` side by side means the `.d.ts` is dead: every
     * import of `./foo` resolves to the `.ts`. Whichever one a generator writes
     * to, half the edits go nowhere.
     */
    const files = readdirSync(typesDir)
    const shadowed = files
      .filter(f => f.endsWith('.d.ts'))
      .map(f => f.slice(0, -5))
      .filter(base => files.includes(`${base}.ts`))

    expect(shadowed).toEqual([])
  })
})

describe('the auto-import declarations describe the runtime', () => {
  /** Every `const X:` the server declaration introduces as a global. */
  function declaredGlobals(): string[] {
    const file = join(typesDir, 'server-auto-imports.d.ts')
    if (!existsSync(file))
      return []

    return [...readFileSync(file, 'utf8').matchAll(/^\s*const (\w+):/gm)].map(m => m[1])
  }

  it('declares something at all', () => {
    // A guard on the guard: if the file were empty or the format changed, every
    // assertion below would pass by describing nothing.
    expect(declaredGlobals().length).toBeGreaterThan(20)
  })

  it('declares nothing that the runtime does not inject', async () => {
    const { injectGlobalAutoImports } = await import('../src/imports')
    await injectGlobalAutoImports()

    const missing = declaredGlobals().filter(name => (globalThis as Record<string, unknown>)[name] === undefined)

    // Each of these is a name that type-checks and throws "is not defined".
    expect(missing).toEqual([])
  })

  it('does not declare a name that would shadow a built-in', () => {
    /*
     * A model called `Error` or `Request` must not become a global: the type
     * would keep the built-in meaning while the runtime handed back a model,
     * and `throw new Error(…)` would construct a database row. The barrel skips
     * them; this checks the declaration agrees.
     */
    const builtIns = ['Error', 'Request', 'Response', 'URL', 'Map', 'Set', 'Date', 'Promise', 'Object', 'Array']
    const shadowing = declaredGlobals().filter(name => builtIns.includes(name))

    expect(shadowing).toEqual([])
  })
})
