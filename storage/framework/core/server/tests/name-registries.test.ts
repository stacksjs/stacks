/**
 * The name registries, and the property that makes them worth having.
 *
 * Actions, listeners, policies and middleware are resolved by NAME at runtime,
 * and every one of those names used to be `string` to the compiler. The fix
 * used to be `storage/framework/types/actions.d.ts`: 1500 lines of generated
 * unions, correct only until somebody added a file without re-running
 * `generate:types` - and unfalsifiable from the runtime's side, because nothing
 * read it but the compiler.
 *
 * These maps are read by BOTH. `keyof` is the type; the resolvers look the file
 * up in the same object. The invariant worth testing is therefore not "the list
 * is right" but "there is only one list": what the map claims exists, exists.
 */

import { describe, expect, it } from 'bun:test'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { path } from '@stacksjs/path'

const registryDir = path.storagePath('framework/auto-imports')

async function load(file: string, exportName: string): Promise<Record<string, string>> {
  const module = await import(`${registryDir}/${file}.ts`) as Record<string, unknown>
  return module[exportName] as Record<string, string>
}

const REGISTRIES = [
  { file: 'actions', exportName: 'actions' },
  { file: 'listeners', exportName: 'listeners' },
  { file: 'policies', exportName: 'policies' },
  { file: 'middleware', exportName: 'middleware' },
] as const

describe('the generated name registries', () => {
  for (const { file, exportName } of REGISTRIES) {
    describe(file, () => {
      it('exists and is not empty', async () => {
        const map = await load(file, exportName)

        expect(typeof map).toBe('object')
        expect(Object.keys(map).length).toBeGreaterThan(0)
      })

      it('every name points at a file that is on disk', async () => {
        const map = await load(file, exportName)
        const missing: string[] = []

        for (const [name, relativePath] of Object.entries(map)) {
          if (!existsSync(resolve(registryDir, relativePath)))
            missing.push(`${name} -> ${relativePath}`)
        }

        expect(missing).toEqual([])
      })

      it('stores paths relative to itself, so the project can move', async () => {
        const map = await load(file, exportName)

        for (const relativePath of Object.values(map))
          expect(relativePath.startsWith('/')).toBe(false)
      })

      it('holds no import thunks - a path map is what keeps it free to read as a type', async () => {
        /*
         * The load-bearing detail. A map of `() => import(...)` gives the
         * resolver the same thing, but `typeof import(barrel)` on it makes the
         * compiler resolve all 700 modules - dragging the entire action graph,
         * and the files the project excludes from its programs, into every
         * compilation that touches an action name.
         */
        const map = await load(file, exportName)

        for (const value of Object.values(map))
          expect(typeof value).toBe('string')
      })
    })
  }

  it('an action name resolves to the application copy when there is one', async () => {
    const actions = await load('actions', 'actions')

    // `app/Actions/SendWelcomeEmail.ts` and the framework default of the same
    // name both exist; the application's has to win, or the override model is
    // a lie the moment anything reads this map.
    expect(actions['Actions/SendWelcomeEmail']).toContain('app/Actions/')
    expect(actions['Actions/SendWelcomeEmail']).not.toContain('defaults/')
  })

  it('names an action by the path a route string uses', async () => {
    const actions = await load('actions', 'actions')

    expect(actions['Actions/Auth/LoginAction']).toBeDefined()
    for (const name of Object.keys(actions))
      expect(name.startsWith('Actions/')).toBe(true)
  })

  it('excludes tests, which are not actions', async () => {
    const actions = await load('actions', 'actions')

    for (const name of Object.keys(actions))
      expect(name.endsWith('.test')).toBe(false)
  })

  it('reaches the framework defaults, not just the application', async () => {
    const middleware = await load('middleware', 'middleware')
    const policies = await load('policies', 'policies')

    // Both ship with Stacks and neither exists in this app's own directories.
    expect(middleware.Signed).toBeDefined()
    expect(policies.PostPolicy).toBeDefined()
  })

  it('routeNames maps a name to the path it resolves to', async () => {
    const module = await import(`${registryDir}/routes.ts`) as { routeNames: Record<string, string> }

    for (const [name, routePath] of Object.entries(module.routeNames)) {
      expect(name.length).toBeGreaterThan(0)
      expect(routePath.startsWith('/')).toBe(true)
    }
  })

  it('is written where the derived declarations read it from', () => {
    // `storage/framework/types/registries.d.ts` reaches these with
    // `typeof import('../auto-imports/<name>')`. If either side moves, the
    // types silently fall back to `string` and check nothing - which is the
    // exact failure this whole arrangement exists to make impossible.
    const declarations = path.storagePath('framework/types/registries.d.ts')

    expect(existsSync(declarations)).toBe(true)
    for (const { file } of REGISTRIES)
      expect(existsSync(resolve(dirname(declarations), '../auto-imports', `${file}.ts`))).toBe(true)
  })

  it('has no generated declaration file left to go stale', () => {
    // The 1500-line union this replaces. Its absence is the point.
    expect(existsSync(path.storagePath('framework/types/actions.d.ts'))).toBe(false)
    expect(existsSync(path.storagePath('framework/types/scheduled.d.ts'))).toBe(false)
  })
})
