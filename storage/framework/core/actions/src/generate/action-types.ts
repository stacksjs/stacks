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
 * Where listeners live, in the order `resolveListener` searches them.
 *
 * `app/Listeners/` first and `app/Actions/` second, then the framework defaults
 * behind each - the same four directories, in the same order, that
 * `@stacksjs/events` walks when it resolves a name out of `app/Events.ts`. The
 * union below is only worth having if it lists exactly what that resolution can
 * find, so it is built from the same list rather than from a second guess at it.
 */
function listenerDirectories(): string[] {
  const candidates = [
    p.appPath('Listeners'),
    p.appPath('Actions'),
    p.storagePath('framework/defaults/app/Listeners'),
    p.storagePath('framework/defaults/app/Actions'),
  ]

  try {
    const pkgJson = Bun.resolveSync('@stacksjs/defaults/package.json', process.cwd())
    const root = pkgJson.slice(0, pkgJson.lastIndexOf('/'))
    candidates.push(`${root}/app/Listeners`, `${root}/app/Actions`)
  }
  catch {
    // No published defaults package; a vendored checkout has them on disk.
  }

  return candidates.filter(dir => existsSync(dir))
}

/**
 * Every name `app/Events.ts` may list against an event.
 *
 * The name is the path under the directory, without the extension, because that
 * is what the map holds and what `resolveListener` joins back on:
 * `'SendWelcomeEmail'`, `'Auth/LoginAction'`.
 *
 * Tests are excluded. `Actions/Auth/token-request.test` is a file in the
 * actions tree and is not a listener, and a union that offers it invites
 * exactly one kind of bug report.
 */
async function collectListenerNames(): Promise<string[]> {
  const found = new Set<string>()

  for (const dir of listenerDirectories()) {
    const files = await readdir(dir, { recursive: true })
    for (const file of files) {
      if (!file.endsWith('.ts') || file.endsWith('.d.ts') || file.endsWith('.test.ts'))
        continue
      found.add(file.slice(0, -3))
    }
  }

  return [...found].sort()
}

/**
 * Where middleware classes live, in the order `loadMiddleware` searches them.
 *
 * The application's own first, the framework defaults behind it.
 */
function middlewareDirectories(): string[] {
  const candidates = [
    p.appPath('Middleware'),
    p.storagePath('framework/defaults/app/Middleware'),
  ]

  try {
    const pkgJson = Bun.resolveSync('@stacksjs/defaults/package.json', process.cwd())
    candidates.push(`${pkgJson.slice(0, pkgJson.lastIndexOf('/'))}/app/Middleware`)
  }
  catch {
    // No published defaults package; a vendored checkout has them on disk.
  }

  return candidates.filter(dir => existsSync(dir))
}

/**
 * Every middleware class an alias may name, by the filename `loadMiddleware`
 * imports: `'Auth'`, `'EnsureEmailIsVerified'`.
 *
 * This is what makes the VALUE side of `app/Middleware.ts` checkable. The keys
 * were already collected below; the values were `string`, so an alias pointing
 * at a class that does not exist compiled and then failed at the one moment it
 * mattered - on a request to the route it was supposed to be guarding.
 */
async function collectMiddlewareClasses(): Promise<string[]> {
  const found = new Set<string>()

  for (const dir of middlewareDirectories()) {
    const files = await readdir(dir, { recursive: true })
    for (const file of files) {
      if (!file.endsWith('.ts') || file.endsWith('.d.ts') || file.endsWith('.test.ts'))
        continue
      found.add(file.slice(0, -3))
    }
  }

  return [...found].sort()
}

/**
 * Every job that can be dispatched or scheduled by name.
 *
 * The application's own `app/Jobs/` first, then the framework defaults - the
 * three candidates `resolveJobFile` tries, in the order it tries them.
 *
 * NOT read from the jobs barrel, which is what the scheduler's declaration used
 * to do: the barrel is generated for the runtime and holds only `app/Jobs/`, so
 * the nine jobs that ship with the framework were unschedulable by type while
 * `resolveJobFile` resolved every one of them.
 */
async function collectJobNames(): Promise<string[]> {
  const found = new Set<string>()

  const candidates = [
    p.appPath('Jobs'),
    p.storagePath('framework/defaults/app/Jobs'),
  ]

  try {
    const pkgJson = Bun.resolveSync('@stacksjs/defaults/package.json', process.cwd())
    candidates.push(`${pkgJson.slice(0, pkgJson.lastIndexOf('/'))}/app/Jobs`)
  }
  catch {
    // No published defaults package; a vendored checkout has them on disk.
  }

  for (const dir of candidates.filter(directory => existsSync(directory))) {
    const files = await readdir(dir, { recursive: true })
    for (const file of files) {
      if (!file.endsWith('.ts') || file.endsWith('.d.ts') || file.endsWith('.test.ts'))
        continue
      found.add(file.slice(0, -3))
    }
  }

  return [...found].sort()
}

/**
 * Every policy class an `app/Gates.ts` mapping may name, by filename.
 *
 * The application's own `app/Policies/` first, the framework defaults behind
 * it - the same order `discoverPolicies` resolves in.
 */
async function collectPolicyNames(): Promise<string[]> {
  const found = new Set<string>()

  const candidates = [
    p.appPath('Policies'),
    p.storagePath('framework/defaults/app/Policies'),
  ]

  try {
    const pkgJson = Bun.resolveSync('@stacksjs/defaults/package.json', process.cwd())
    candidates.push(`${pkgJson.slice(0, pkgJson.lastIndexOf('/'))}/app/Policies`)
  }
  catch {
    // No published defaults package; a vendored checkout has them on disk.
  }

  for (const dir of candidates.filter(directory => existsSync(directory))) {
    const files = await readdir(dir, { recursive: true })
    for (const file of files) {
      if (!file.endsWith('.ts') || file.endsWith('.d.ts') || file.endsWith('.test.ts'))
        continue
      found.add(file.slice(0, -3))
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
  const middlewareClasses = await collectMiddlewareClasses()
  const listeners = await collectListenerNames()
  const policies = await collectPolicyNames()
  const jobs = await collectJobNames()
  const namedRoutes = await collectNamedRoutes()
  const union = actions.map(action => `\n  | '${action}'`).join('')
  /*
   * Both the plain alias and its negated form. Stacks reads a leading `!` as
   * "everything except", so `'!auth'` is a legal reference and a union without
   * it would reject working code. Parameterised forms (`'throttle:60,1'`) are
   * covered by bun-router's own `${alias}:${string}` branch.
   */
  /*
   * Aliases and class names both, each with its negated form.
   *
   * Class names are in here because they resolve: an unaliased middleware is
   * reached by name through `toPascalCase`, which is how `Signed.ts` documents
   * itself (`.middleware('signed')`) without ever having had an alias. Leaving
   * them out made the type reject references that work.
   */
  const middlewareUnion = [...new Set([...aliases, ...middlewareClasses])]
    .sort()
    .flatMap(alias => [`\n  | '${alias}'`, `\n  | '!${alias}'`])
    .join('')
  const middlewareClassUnion = middlewareClasses.map(name => `\n  | '${name}'`).join('')
  /*
   * Emitted as `never` when nothing is on disk rather than as `string`. The
   * consumer (`ListenerName` in `@stacksjs/events`) reads an empty registry as
   * "not generated yet" and falls back to `string` itself, so widening here
   * would only hide the difference between "no listeners" and "not generated".
   */
  const listenerUnion = listeners.map(listener => `\n  | '${listener}'`).join('')
  const policyUnion = policies.map(policy => `\n  | '${policy}'`).join('')
  const jobUnion = jobs.map(job => `\n  | '${job}'`).join('')
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
 * Every middleware alias and class this application can reference, and the
 * negated form of each.
 */
export type MiddlewareAlias =${middlewareUnion || '\n  | string'}

/**
 * Every middleware class on disk, by the filename the router imports. This is
 * what an alias in \`app/Middleware.ts\` may point at.
 */
export type MiddlewareClassName =${middlewareClassUnion || '\n  | never'}

/**
 * Every listener \`app/Events.ts\` can name against an event: the application's
 * own listeners and actions, plus the framework defaults behind them.
 */
export type EventListenerName =${listenerUnion || '\n  | never'}

/**
 * Every policy class an \`app/Gates.ts\` mapping can name: the application's own
 * policies, plus the framework defaults behind them.
 */
export type PolicyClassName =${policyUnion || '\n  | never'}

/**
 * Every job that can be dispatched or scheduled by name: the application's own,
 * plus the framework defaults behind them.
 */
export type JobName =${jobUnion || '\n  | never'}

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

/**
 * Handed to the event bus, so \`app/Events.ts\` is checked against the listeners
 * that are actually on disk rather than against \`string\`.
 */
declare module '@stacksjs/events' {
  interface EventListeners extends Record<EventListenerName, true> {}
}

/**
 * Handed to the router, so the alias map in \`app/Middleware.ts\` is checked
 * against the middleware that exist rather than against \`string\`.
 */
declare module '@stacksjs/router' {
  interface MiddlewareClasses extends Record<MiddlewareClassName, true> {}
}

/**
 * Handed to the authorization gate, so a policy mapping in \`app/Gates.ts\` is
 * checked against the policies that exist rather than against \`string\`.
 */
declare module '@stacksjs/auth' {
  interface PolicyClasses extends Record<PolicyClassName, true> {}
}

/**
 * Handed to the queue and the scheduler, so \`job('SendWelcomeEmial')\` and
 * \`schedule.job(…)\` are checked against the jobs \`resolveJobFile\` can find.
 */
declare module '@stacksjs/queue' {
  interface Jobs extends Record<JobName, true> {}
}

declare module '@stacksjs/scheduler' {
  interface SchedulableJobs extends Record<JobName, true> {}
}
`

  await storage.writeFile(p.frameworkPath('types/actions.d.ts'), contents)
  log.debug(`[generate:types] Wrote ${actions.length} action paths, ${aliases.length} middleware aliases, ${middlewareClasses.length} middleware classes, ${listeners.length} listener names, ${policies.length} policies, ${jobs.length} jobs and ${Object.keys(namedRoutes).length} named routes`)
}
