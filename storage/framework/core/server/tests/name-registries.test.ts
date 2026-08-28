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
import { existsSync, readFileSync } from 'node:fs'
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
  { file: 'emails', exportName: 'emails' },
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

  it('email templates prefer .stx over .html, as the resolver does', async () => {
    const emails = await load('emails', 'emails')

    // `welcome` ships as `.stx`; the key is bare, so `template('welcome')`
    // and `template('welcome.stx')` both mean this file.
    expect(emails.welcome).toEndWith('.stx')
    for (const name of Object.keys(emails)) {
      expect(name.endsWith('.stx')).toBe(false)
      expect(name.endsWith('.html')).toBe(false)
    }
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

  it('generates the same bytes twice, so a commit does not churn', async () => {
    /*
     * The order was `localeCompare` for one commit, which is locale-dependent:
     * the same directory produced a different file order on two machines, and
     * the committed map churned for no reason. A byte comparison is the same
     * everywhere.
     */
    const before = await Bun.file(`${registryDir}/actions.ts`).text()
    const { generateAutoImportFiles } = await import('../src/imports')
    await generateAutoImportFiles()
    const after = await Bun.file(`${registryDir}/actions.ts`).text()

    expect(after).toBe(before)
  })

  it('has no generated declaration file left to go stale', () => {
    // The 1500-line union this replaces. Its absence is the point.
    expect(existsSync(path.storagePath('framework/types/actions.d.ts'))).toBe(false)
    expect(existsSync(path.storagePath('framework/types/scheduled.d.ts'))).toBe(false)
  })
})

/**
 * The global declarations and the globals themselves.
 *
 * `server-auto-imports.d.ts` is one of the two files the framework still
 * generates, and it is generated for a reason TypeScript imposes rather than a
 * choice: `declare global` takes literal identifiers, and there is no way to
 * spread a type into the global scope. What CAN be removed is the second
 * derivation - and it was there. The declaration scanned the model, job and
 * controller directories itself while `injectGlobalAutoImports` read the
 * barrels, so the two worked the same fact out twice and disagreed about jobs:
 * every job the framework ships was a global at runtime with no type at all.
 */
describe('the generated global declarations', () => {
  const declarations = path.storagePath('framework/types/server-auto-imports.d.ts')

  function declaredNames(): Set<string> {
    const source = readFileSync(declarations, 'utf8')

    return new Set([...source.matchAll(/^ {2}const (\w+):/gm)].map(match => match[1]!))
  }

  async function barrelNames(barrel: string): Promise<string[]> {
    const file = `${registryDir}/${barrel}.ts`
    if (!existsSync(file))
      return []

    return [...readFileSync(file, 'utf8').matchAll(/^export \{ default as (\w+) \}/gm)].map(match => match[1]!)
  }

  it('declares every name the barrels put on globalThis', async () => {
    const declared = declaredNames()
    const undeclared: string[] = []

    for (const barrel of ['models', 'jobs', 'controllers']) {
      for (const name of await barrelNames(barrel)) {
        if (!declared.has(name))
          undeclared.push(`${barrel}: ${name}`)
      }
    }

    // A global with no declaration is the quieter half of the failure: the
    // name works at runtime and the compiler says it does not exist, so people
    // add an import that was never needed, or an `as any`.
    expect(undeclared).toEqual([])
  })

  it('declares every model @stacksjs/orm injects as a lazy proxy', async () => {
    const { modelGlobalNames } = await import('@stacksjs/orm') as { modelGlobalNames: readonly string[] }
    const declared = declaredNames()

    expect(modelGlobalNames.length).toBeGreaterThan(0)

    /*
     * The ORM injects the COMPLETE framework model surface, feature-gated or
     * not, which is why the declaration cannot come from the barrel alone: an
     * app without the CMS enabled has no `Post` in its barrel and can still
     * call `await Post.all()`.
     *
     * Names that would shadow a JavaScript built-in are the exception, and are
     * skipped on both sides: the ORM only assigns when the global is undefined,
     * and `globalThis.Request` is a Response/Request pair the platform already
     * provides.
     */
    const shadowsBuiltIn = new Set(['Error', 'Request', 'Response'])
    const undeclared = modelGlobalNames.filter(name => !shadowsBuiltIn.has(name) && !declared.has(name))

    expect(undeclared).toEqual([])
  })

  it('declares nothing that no barrel and no proxy provides', async () => {
    const { modelGlobalNames } = await import('@stacksjs/orm') as { modelGlobalNames: readonly string[] }
    const provided = new Set<string>(modelGlobalNames)

    for (const barrel of ['models', 'jobs', 'controllers']) {
      for (const name of await barrelNames(barrel))
        provided.add(name)
    }

    // The framework primitives (`path`, `log`, `schema`, …) come from
    // `primitiveAutoImportEntries()` and are declared by package specifier, so
    // only the file-backed half is checked here.
    const source = readFileSync(declarations, 'utf8')
    const fileBacked = [...source.matchAll(/^ {2}const (\w+): typeof import\('\.[^']*'\)/gm)].map(match => match[1]!)

    /*
     * The louder half: a declared name that nothing provides type-checks and
     * then throws `X is not defined`. A previous declaration file carried 36 of
     * these, including nine models from a different application.
     */
    expect(fileBacked.filter(name => !provided.has(name))).toEqual([])
  })
})

/**
 * The browser globals, and whether they exist.
 *
 * `types/browser-auto-imports.d.ts` tells the compiler which names an stx
 * script block can use bare. It is a committed artifact of
 * `unplugin-auto-import`, which nothing in this repository runs, and it had
 * drifted to declaring 405 globals of which 291 were not exported by the module
 * named beside them - 229 from a single file that exports 15.
 *
 * It survived because the file opened with `@ts-nocheck`, so every
 * `typeof import(...)['name']` in it went unchecked. A declaration nothing
 * checks is believed by everything: `charIn(...)` type-checked and threw
 * `charIn is not defined`.
 */
describe('the browser global declarations', () => {
  const declarations = path.storagePath('framework/types/browser-auto-imports.d.ts')

  function declared(): Array<{ name: string, from: string, exported: string }> {
    const source = readFileSync(declarations, 'utf8')

    return [...source.matchAll(/^ {2}const (\w+): typeof import\('([^']+)'\)\['(\w+)'\]/gm)]
      .map(match => ({ name: match[1]!, from: match[2]!, exported: match[3]! }))
  }

  it('declares only names the module beside them exports', async () => {
    const cache = new Map<string, Set<string> | null>()
    const phantom: string[] = []

    for (const entry of declared()) {
      if (!cache.has(entry.from)) {
        try {
          const specifier = entry.from.startsWith('.')
            ? resolve(path.storagePath('framework/types'), entry.from)
            : entry.from
          cache.set(entry.from, new Set(Object.keys(await import(specifier) as Record<string, unknown>)))
        }
        catch {
          // Unresolvable here is not the same as absent everywhere; a module
          // this install lacks is not evidence against the declaration.
          cache.set(entry.from, null)
        }
      }

      const exported = cache.get(entry.from)
      if (exported && !exported.has(entry.exported))
        phantom.push(`${entry.name} from ${entry.from}`)
    }

    expect(phantom).toEqual([])
  })

  it('carries no @ts-nocheck, so the declarations are checked', () => {
    // The whole reason 291 of them went unnoticed. Without this the file can
    // silently stop being checked again and nothing would say so.
    expect(readFileSync(declarations, 'utf8')).not.toContain('@ts-nocheck')
  })

  it('agrees with the eslint globals manifest beside it', () => {
    const manifest = JSON.parse(readFileSync(path.storagePath('framework/browser-auto-imports.json'), 'utf8')) as {
      globals: Record<string, true>
    }

    // Two files, one list. They are written together for the same reason the
    // server pair is: derived separately, they drift, and the lint config
    // starts flagging a real global as undefined.
    const missing = declared().map(entry => entry.name).filter(name => !(name in manifest.globals))
    expect(missing).toEqual([])
  })
})
