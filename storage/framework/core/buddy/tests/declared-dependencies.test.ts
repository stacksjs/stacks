import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'bun:test'

/**
 * Every `@stacksjs/*` this package imports is one it depends on.
 *
 * `@stacksjs/buddy` shipped for a long time importing five packages it never
 * declared — `env`, `analytics`, `browser-extension`, `scheduler` and
 * `tinker` — and it worked, because buddy is nearly always run from inside a
 * scaffolded application whose own tree happens to contain them. Installed on
 * its own it did not run at all:
 *
 *     Cannot find module '@stacksjs/query-builder' from
 *     node_modules/@stacksjs/database/dist/index.js
 *
 * which is the same bug one package over. That is the failure mode this
 * guards: a dependency satisfied by the neighbourhood rather than by the
 * manifest is invisible until somebody installs the package alone.
 */

const packageRoot = dirname(import.meta.dir)

/** Every `@stacksjs/*` specifier under `src`, from static and dynamic imports. */
function importedScopedPackages(dir: string, found = new Set<string>()): Set<string> {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)

    if (statSync(path).isDirectory()) {
      importedScopedPackages(path, found)
      continue
    }

    if (!path.endsWith('.ts'))
      continue

    const source = readFileSync(path, 'utf-8')

    for (const match of source.matchAll(/from\s+['"](@stacksjs\/[a-z0-9-]+)['"]/g))
      found.add(match[1]!)

    for (const match of source.matchAll(/import\(['"](@stacksjs\/[a-z0-9-]+)['"]\)/g))
      found.add(match[1]!)
  }

  return found
}

describe('the manifest covers what the source imports', () => {
  it('declares every @stacksjs package buddy imports', () => {
    const manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf-8'))
    const declared = new Set(Object.keys(manifest.dependencies ?? {}))

    /*
     * `@stacksjs/stx` is the one exemption, and it is a real one: it is
     * imported inside a try/catch in `production-server.ts` to pick up the
     * *application's* stx if it has one. Declaring it would make buddy carry a
     * renderer it only ever borrows.
     */
    const optional = new Set(['@stacksjs/stx'])

    const undeclared = [...importedScopedPackages(join(packageRoot, 'src'))]
      .filter(name => !declared.has(name) && !optional.has(name))
      .sort()

    expect(undeclared).toEqual([])
  })
})
