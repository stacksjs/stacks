/**
 * The action paths this application can route to, as a type.
 *
 * `route.post('/login', 'Actions/Auth/LoginAction')` names a file with a
 * string, and the compiler has never had anything to say about it: a typo is a
 * 500 on that one endpoint, found by whoever hits it first.
 *
 * Three separate reasons it stayed that way, all fixed here:
 *
 *  1. This generator was orphaned. Nothing called it, so `types/actions.d.ts`
 *     held whatever was last written by hand.
 *  2. It only read `app/Actions/`. The 80+ actions under the framework defaults
 *     were missing, so a complete union would have rejected most of the route
 *     files that ship.
 *  3. Its output was a bare `export type ActionPath`, which nothing referenced,
 *     and the committed file ended in `| string` - which collapses a union of
 *     literals back to `string` and types precisely nothing.
 *
 * What it writes now is a `RouterTypeRegistry` augmentation, which
 * `@stacksjs/bun-router` reads to constrain every string handler position. See
 * that package's `types/registry.ts`.
 */

import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { log } from '@stacksjs/logging'
import { path as p } from '@stacksjs/path'
import { storage } from '@stacksjs/storage'

/**
 * Where actions live, in override order.
 *
 * The application's own first, the framework defaults second - the same order
 * the router resolves them in. A vendored checkout has the defaults on disk; an
 * installed app has them inside the published `@stacksjs/defaults` package, so
 * both are tried and whichever exists is read.
 */
function actionDirectories(): string[] {
  const candidates = [
    p.appPath('Actions'),
    p.storagePath('framework/defaults/app/Actions'),
  ]

  try {
    const pkgJson = Bun.resolveSync('@stacksjs/defaults/package.json', process.cwd())
    candidates.push(`${pkgJson.slice(0, pkgJson.lastIndexOf('/'))}/app/Actions`)
  }
  catch {
    // No published defaults package; a vendored checkout has them on disk.
  }

  return candidates.filter(dir => existsSync(dir))
}

async function collectActionPaths(): Promise<string[]> {
  const found = new Set<string>()

  for (const dir of actionDirectories()) {
    const files = await readdir(dir, { recursive: true })
    for (const file of files) {
      if (!file.endsWith('.ts') || file.endsWith('.d.ts'))
        continue
      found.add(`Actions/${file.slice(0, -3)}`)
    }
  }

  return [...found].sort()
}

/**
 * The middleware aliases this application can reference.
 *
 * Read from the alias maps themselves - `app/Middleware.ts` first, the
 * framework defaults behind it - by importing them, because they are plain
 * modules and their keys are the answer. Parsing the source for keys would be
 * a second, worse implementation of `import`.
 */
async function collectMiddlewareAliases(): Promise<string[]> {
  const found = new Set<string>()

  const candidates = [
    p.appPath('Middleware.ts'),
    p.storagePath('framework/defaults/app/Middleware.ts'),
  ]

  for (const file of candidates) {
    if (!existsSync(file))
      continue

    try {
      const module = await import(`${file}?t=${Date.now()}`) as { default?: Record<string, unknown> }
      for (const alias of Object.keys(module.default ?? {}))
        found.add(alias)
    }
    catch {
      // A malformed alias map is the app's problem to surface elsewhere; it
      // must not take `generate:types` down with it.
    }
  }

  return [...found].sort()
}

/**
 * Every named route, as `name → path`.
 *
 * Read from the live route table rather than by scanning source, because a
 * name is attached by a chained `.name()` call whose path may have come from a
 * group prefix - a static scan would have to re-implement the router to know
 * what `/users/{id}` a given `.name('users.show')` actually got. Loading the
 * routes is the same thing the OpenAPI generator does, and for the same reason.
 *
 * Best-effort on purpose. A route registry that fails to load leaves the
 * `routes` key out entirely, which falls back to "any name" - the behaviour
 * before this existed. Refusing to generate types because one route file threw
 * would be a much worse trade than an unchecked `url()`.
 */
async function collectNamedRoutes(): Promise<Record<string, string>> {
  const registryFile = p.appPath('Routes.ts')
  if (!existsSync(registryFile))
    return {}

  try {
    const { listNamedRoutes, loadRoutes } = await import('@stacksjs/router')
    const { default: routeRegistry } = await import(registryFile) as { default: Parameters<typeof loadRoutes>[0] }
    await loadRoutes(routeRegistry)
    return listNamedRoutes()
  }
  catch (error) {
    log.debug('[generate:types] Could not load routes for named-route types', { error })
    return {}
  }
}

/**
 * Write `storage/framework/types/actions.d.ts`.
 *
 * Controllers stay a pattern rather than a union: they are addressed as
 * `'Controllers/UserController@show'`, and the method half is a member name
 * that would need the file parsed rather than listed. Catching the shape is
 * what was already on offer for them, and it is unchanged.
 */
export async function generateActionTypes(): Promise<void> {
  log.info('Generating action types...')

  const actions = await collectActionPaths()

  if (actions.length === 0) {
    log.debug('[generate:types] No action directories found; leaving actions.d.ts alone')
    return
  }

  const aliases = await collectMiddlewareAliases()
  const namedRoutes = await collectNamedRoutes()
  const union = actions.map(action => `\n  | '${action}'`).join('')
  /*
   * Both the plain alias and its negated form. Stacks reads a leading `!` as
   * "everything except", so `'!auth'` is a legal reference and a union without
   * it would reject working code. Parameterised forms (`'throttle:60,1'`) are
   * covered by bun-router's own `${alias}:${string}` branch.
   */
  const middlewareUnion = aliases
    .flatMap(alias => [`\n  | '${alias}'`, `\n  | '!${alias}'`])
    .join('')
  /*
   * `name: path`, so the router can pull a route's params out of its path and
   * demand them. Emitted as an empty object when nothing is named, which the
   * router reads as "no declaration" and falls back to any name - rather than
   * as "there are no routes", which would reject every `url()` in the app.
   */
  const routeEntries = Object.entries(namedRoutes)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, routePath]) => `\n  '${name}': '${routePath}'`)
    .join('')

  const contents = `// This file is auto-generated by Stacks. Do not edit this file manually.
// If you wish to rename an action, please do so by editing the file name.
//
// For more information, please visit: https://stacksjs.com/docs

/**
 * Every action this application can route to: its own, plus the framework
 * defaults it has not overridden.
 */
export type ActionPath =${union}

/**
 * Every middleware alias this application registers, and its negated form.
 */
export type MiddlewareAlias =${middlewareUnion || '\n  | string'}

/**
 * Every named route, and the path it resolves to.
 *
 * A type alias, NOT an interface: only aliases of object literals get an
 * implicit index signature, so an interface here fails the router's
 * \`extends Record<string, string>\` shape check and the whole map is quietly
 * ignored.
 */
export type NamedRoutes = {${routeEntries ? `${routeEntries}\n` : ''}}

/**
 * Handed to the router, so \`route.get(path, 'Actions/…')\` and
 * \`.middleware('auth')\` are checked against the lists above rather than
 * against a string. A controller reference stays a pattern - the method half is
 * a member name, not a filename.
 */
declare module '@stacksjs/bun-router' {
  interface RouterTypeRegistry {
    actions: ActionPath | \`\${string}Controller@\${string}\`
    middleware: MiddlewareAlias
    routes: NamedRoutes
  }
}
`

  await storage.writeFile(p.frameworkPath('types/actions.d.ts'), contents)
  log.debug(`[generate:types] Wrote ${actions.length} action paths, ${aliases.length} middleware aliases and ${Object.keys(namedRoutes).length} named routes`)
}
