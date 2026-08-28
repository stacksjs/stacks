/**
 * Boot-time listener auto-discovery (stacksjs/stacks#1878 E-3,
 * carrying forward F-3 from #1874).
 *
 * Background: events package exports a singleton emitter (`listen`,
 * `dispatch`, etc.), but there's no convention-over-configuration
 * path that scans `app/Listeners/**\/*.ts` and wires up every
 * listener at boot. Apps that follow the standard Stacks layout
 * have to manually `import` every listener file from somewhere or
 * their listeners silently never fire.
 *
 * This module adds `discoverListeners(dir)` that walks a directory
 * (default `app/Listeners`), imports each `.ts` / `.js` file, and
 * registers the default export as a listener if it matches a
 * documented shape:
 *
 * ```ts
 * // app/Listeners/SendWelcomeEmail.ts
 * import { defineListener } from '@stacksjs/events'
 *
 * export default defineListener({
 *   listensTo: 'user:registered',
 *   handle: async (user) => {
 *     await mail.send({ to: user.email, ... })
 *   },
 * })
 * ```
 *
 * A plain object literal still works - the scan checks the shape at runtime -
 * but `defineListener` is what checks the event name and types the payload
 * from it.
 *
 * Errors during import (syntax errors, missing default export,
 * malformed listener shape) are logged but don't halt discovery —
 * one broken listener shouldn't prevent others from registering.
 *
 * `registerAppListeners()` is the boot entry point and does both
 * halves: the `app/Events.ts` map (event name → listener names,
 * the documented way to say that three listeners share an event)
 * and this directory scan (a listener declaring its own
 * `listensTo`). Both existed on paper and neither was called by
 * anything, so an application following either convention had a
 * bus with no listeners on it — `dispatch` succeeded, silently,
 * forever. That is the worst shape a defect can take: every piece
 * looks implemented and the only symptom is nothing happening.
 */

import { existsSync, readdirSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'
import process from 'node:process'
import type { EventName, StacksEvents } from './index'
import { listen } from './index'

/**
 * What a listener may subscribe to: an event that exists, or a glob the
 * emitter matches against every event name (`'user:*'`, `'*'`).
 *
 * The glob branch is why this is not simply `EventName`. `registerFromMap` and
 * the scan both hand their names to `emitter.on`, which matches patterns as
 * well as exact names, so a union without them would reject a subscription
 * that works.
 */
export type EventSubscription = EventName | '*' | `${string}:*`

/**
 * The payload a subscription carries.
 *
 * Exact for an exact event name. A glob can fire for any event, so it gets the
 * union of what the bus can carry rather than a guess at which one.
 */
export type SubscriptionPayload<T extends EventSubscription> = T extends EventName
  ? StacksEvents[T]
  : StacksEvents[EventName]

/**
 * Shape of a listener module's default export.
 *
 * `listensTo` was `string | string[]`, with a comment explaining that the loose
 * type bought "cross-pkg flexibility". What it actually bought was a listener
 * file that compiles while subscribing to an event that does not exist: the
 * scan registers it, the emitter never matches it, and the file looks like it
 * is doing its job forever. The names are checked now, and the payload follows
 * from the name rather than being `unknown` for the handler to assert its way
 * out of.
 */
export interface ListenerModule<T extends EventSubscription = EventSubscription> {
  /**
   * Event name to subscribe to, or several. Required.
   *
   * An array is the common case once a listener does one thing for a family
   * of events - "write this down", "call the subscriber's server" - and
   * accepting only a string forced those to be split into one near-identical
   * file per event, or to go unregistered. Unregistered is what happened: a
   * listener declaring an array failed the shape check and was skipped with a
   * warning nobody reads at boot.
   */
  listensTo: T | readonly T[]
  /**
   * Listener function. Required.
   *
   * Called with the payload and, second, the name of the event that fired.
   * The second argument is what makes one handler over several events
   * possible without the emitter's payload having to carry its own name.
   */
  handle: (_payload: SubscriptionPayload<T>, _eventName?: EventName) => void | Promise<void>
  /** Optional human-readable name for logging. Defaults to filename. */
  name?: string
}

/**
 * Define a listener module, with the event names checked and the payload
 * inferred from them.
 *
 * The same helper `defineEvents` is for `app/Events.ts`, for the other half of
 * the convention: a plain object literal cannot infer `T` from `listensTo`, so
 * without this the handler's payload widens to the union of everything the bus
 * carries and the event names go unchecked.
 *
 * @example
 * ```ts
 * // app/Listeners/SendWelcomeEmail.ts
 * import { defineListener } from '@stacksjs/events'
 *
 * export default defineListener({
 *   listensTo: 'user:registered',
 *   handle: async (user) => {
 *     // `user` is the registration payload, not `unknown`
 *     await mail.send({ to: user.email })
 *   },
 * })
 * ```
 */
export function defineListener<const T extends EventSubscription>(
  listener: ListenerModule<T>,
): ListenerModule<T> {
  return listener
}

interface DiscoverOptions {
  /**
   * Absolute path to the listeners directory. Defaults to
   * `<cwd>/app/Listeners`.
   */
  dir?: string
  /**
   * File extensions to import. Defaults to `['.ts', '.js']`.
   */
  extensions?: string[]
  /**
   * Custom logger. Defaults to `console.warn` / `console.error`
   * for visibility without adding a logging dependency.
   */
  log?: {
    warn?: (msg: string) => void
    error?: (msg: string) => void
    info?: (msg: string) => void
  }
}

/**
 * Walk the listeners directory and register every default-exported
 * listener that matches the `ListenerModule` shape. Returns the
 * count of successfully registered listeners.
 *
 * @example
 * ```ts
 * // In your framework boot path:
 * import { discoverListeners } from '@stacksjs/events'
 *
 * await discoverListeners()  // defaults to app/Listeners
 * // or
 * await discoverListeners({ dir: '/custom/path' })
 * ```
 */
export async function discoverListeners(options: DiscoverOptions = {}): Promise<number> {
  const dir = options.dir ?? join(process.cwd(), 'app', 'Listeners')
  const extensions = options.extensions ?? ['.ts', '.js']
  const logger = {
    warn: options.log?.warn ?? ((msg: string) => console.warn(msg)),
    error: options.log?.error ?? ((msg: string) => console.error(msg)),
    info: options.log?.info ?? ((msg: string) => console.info(msg)),
  }

  if (!existsSync(dir)) {
    // Not an error — many projects don't have a listeners directory.
    // Stay silent so boot logs don't fill with "no listeners found"
    // for every CLI command.
    return 0
  }

  const files = collectFiles(dir, extensions)
  if (files.length === 0) return 0

  let registered = 0
  for (const filepath of files) {
    try {
      const mod = await import(filepath)
      const exported = mod?.default ?? mod

      /*
       * A function default export is not a malformed listener.
       *
       * `app/Listeners/` also holds CLI listeners - the framework ships one,
       * `Console.ts`, which takes the CLI and registers command handlers - and
       * those export a function. Warning about it made every application warn
       * about a file the framework itself put there, on every boot, which is
       * how people learn to stop reading boot output.
       */
      if (typeof exported === 'function')
        continue

      if (!isListenerModule(exported)) {
        logger.warn(`[events/discover] ${filepath}: default export doesn't match ListenerModule shape ({ listensTo, handle }), skipping`)
        continue
      }

      for (const event of eventsOf(exported.listensTo)) {
        // Registered once per (event, module), so a listener that also appears
        // in `app/Events.ts` does not run twice. Two identical inbox rows read
        // as a product bug; two identical audit rows read as two events.
        if (!claim(event, filepath))
          continue

        // The name is passed as a second argument so one handler can serve
        // several events. The emitter calls handlers with the payload alone,
        // so without this wrapper a multi-event listener has to be told which
        // event fired by whoever emitted it - which every emitter then has to
        // remember, and one of them will not.
        listen(event as never, ((payload: unknown) => exported.handle(payload as never, event as EventName)) as never)
        registered++
      }
    }
    catch (err) {
      logger.error(`[events/discover] failed to import ${filepath}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  if (registered > 0)
    logger.info(`[events/discover] registered ${registered} listener${registered === 1 ? '' : 's'} from ${dir}`)

  return registered
}

/**
 * Recursively collect every file under `dir` with an allowed
 * extension. Symlinks are followed via `fs.statSync` which throws
 * on broken links — those propagate to the caller, who can decide
 * whether to retry or fail.
 */
function collectFiles(dir: string, extensions: string[]): string[] {
  const out: string[] = []
  const entries = readdirSync(dir)
  for (const name of entries) {
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) {
      out.push(...collectFiles(full, extensions))
    }
    else if (st.isFile() && extensions.includes(extname(name))) {
      out.push(full)
    }
  }
  return out
}

function isListenerModule(v: unknown): v is ListenerModule {
  const listensTo = (v as { listensTo?: unknown } | null)?.listensTo

  return (
    !!v
    && typeof v === 'object'
    && (typeof listensTo === 'string' || Array.isArray(listensTo))
    && typeof (v as { handle?: unknown }).handle === 'function'
  )
}

/**
 * One event, or several, as a list either way. Blank names are dropped.
 *
 * Takes `unknown` rather than the declared type because this runs on a module
 * that was just imported off disk: `isListenerModule` has checked the shape at
 * runtime, and nothing has checked that the file was compiled at all.
 */
function eventsOf(listensTo: unknown): string[] {
  const names = Array.isArray(listensTo) ? listensTo : [listensTo]

  return names.map(name => String(name).trim()).filter(Boolean)
}

/**
 * Every (event, listener) pair registered so far this process.
 *
 * Boot is not a single call: `app/Events.ts` names listeners explicitly, a
 * listener may also declare its own `listensTo`, and dev servers re-run boot on
 * reload. Without this, a listener that does both is registered twice and every
 * event it handles happens twice - and a double-written row is far harder to
 * notice than a missing one, because the feature looks like it works.
 *
 * Keyed by event and by module identity rather than by the handler function:
 * the wrapper below is a fresh closure each time, so function identity would
 * never match.
 */
const claimed = new Set<string>()

function claim(event: string, moduleId: string): boolean {
  const key = `${event} ${moduleId}`

  if (claimed.has(key))
    return false

  claimed.add(key)

  return true
}

/** For tests, and for a dev server that genuinely wants to start over. */
export function resetListenerRegistry(): void {
  claimed.clear()
}

interface RegisterOptions extends DiscoverOptions {
  /** Project root. Defaults to `process.cwd()`. */
  base?: string
}

/**
 * Register every listener the application declares, from both conventions.
 *
 * This is the function a boot path calls. It reads `app/Events.ts` - the map of
 * event name to listener names that the file's own comment documents - and then
 * scans `app/Listeners/` for anything that declares its own `listensTo`.
 *
 * Both halves are needed and neither subsumes the other. The map is how an
 * application says three listeners share one event and in what order; the scan
 * is how a listener that stands alone avoids a second edit in a second file.
 * The registry above stops a listener that does both from running twice.
 *
 * Returns how many (event, listener) pairs were registered. Never throws: a
 * broken listener file must not stop a server from starting, because the
 * alternative is an application that will not boot over a typo in a notifier.
 */
export async function registerAppListeners(options: RegisterOptions = {}): Promise<number> {
  const base = options.base ?? process.cwd()
  const logger = {
    warn: options.log?.warn ?? ((msg: string) => console.warn(msg)),
    error: options.log?.error ?? ((msg: string) => console.error(msg)),
    info: options.log?.info ?? ((msg: string) => console.info(msg)),
  }

  let registered = 0

  registered += await registerFromMap(base, logger)
  registered += await discoverListeners({ ...options, dir: options.dir ?? join(base, 'app', 'Listeners'), log: { ...logger, info: () => {} } })

  if (registered > 0)
    logger.info(`[events] registered ${registered} listener${registered === 1 ? '' : 's'}`)

  return registered
}

/**
 * The `app/Events.ts` half.
 *
 * A listener name is resolved against `app/Listeners/` first and `app/Actions/`
 * second, which is the order the default `app/Events.ts` comment describes and
 * the order that matches what applications actually do: `SendWelcomeEmail` is
 * an action, `Notify` is a listener, and both appear in the same map.
 */
async function registerFromMap(
  base: string,
  logger: { warn: (_m: string) => void, error: (_m: string) => void },
): Promise<number> {
  const eventsFile = ['ts', 'js']
    .map(extension => join(base, 'app', `Events.${extension}`))
    .find(candidate => existsSync(candidate))

  if (!eventsFile)
    return 0

  let map: Record<string, unknown>

  try {
    const mod = await import(eventsFile)
    map = (mod?.default ?? mod) as Record<string, unknown>
  }
  catch (err) {
    logger.error(`[events] failed to read ${eventsFile}: ${err instanceof Error ? err.message : String(err)}`)

    return 0
  }

  if (!map || typeof map !== 'object')
    return 0

  let registered = 0

  for (const [event, names] of Object.entries(map)) {
    for (const name of Array.isArray(names) ? names : [names]) {
      if (typeof name !== 'string' || !name.trim())
        continue

      const resolved = await resolveListener(base, name.trim())

      if (!resolved) {
        // Warned rather than ignored. A name in this map that resolves to
        // nothing is a listener somebody believes is running, and the whole
        // reason this function exists is that a silent no-op here is
        // indistinguishable from a quiet week.
        logger.warn(`[events] ${event}: no listener or action called ${name}`)
        continue
      }

      if (!claim(event, resolved.id))
        continue

      const handle = resolved.handle
      const validations = resolved.validations
      listen(event as never, ((payload: unknown) => {
        warnOnPayloadMismatch(event, name, payload, validations, logger)
        return handle(payload, event)
      }) as never)
      registered++
    }
  }

  return registered
}

/** An action's `validations:`, as much of it as this module needs. */
type PayloadValidations = Record<string, { rule?: { validate?: (_value: unknown) => { valid: boolean } } }>

/**
 * Say something when a dispatched payload does not match what the action says
 * it takes.
 *
 * An action declaring `invocation: 'event'` describes its payload with
 * `validations`, and that is what types `handle`'s parameter. Nothing ran them,
 * though - the router validates a REQUEST, and there is no request on this
 * path - so the declaration typed the payload and checked nothing, and a
 * dispatcher that sent `{ userId }` where the action reads `id` produced
 * `undefined` inside the handler with nothing said anywhere.
 *
 * Warns rather than throws, deliberately. A mismatch is a bug worth surfacing,
 * and a listener is not the place to decide that a registration flow should
 * fail: the dispatcher has already committed the thing the event is announcing.
 */
function warnOnPayloadMismatch(
  event: string,
  name: string,
  payload: unknown,
  validations: PayloadValidations | undefined,
  logger: { warn: (_message: string) => void },
): void {
  if (!validations || typeof payload !== 'object' || payload === null)
    return

  const bag = payload as Record<string, unknown>
  const bad: string[] = []

  for (const [key, entry] of Object.entries(validations)) {
    const validate = entry?.rule?.validate
    if (typeof validate !== 'function')
      continue

    try {
      if (!validate(bag[key]).valid)
        bad.push(key)
    }
    catch {
      // A rule that throws on an unexpected value is telling us the same
      // thing, and is not a reason to take the dispatch down with it.
      bad.push(key)
    }
  }

  if (bad.length)
    logger.warn(`[events] ${event}: payload does not match what ${name} declares (${bad.join(', ')})`)
}

/**
 * Where a listener name is looked up, in override order.
 *
 * The application's own `app/` first, the framework defaults behind it - the
 * same order everything else in Stacks resolves in. Only `app/` was searched
 * before, which made every one of the 80+ default actions unnameable from
 * `app/Events.ts`: `'Auth/LoginAction'` warned "no listener or action called"
 * and the event went unhandled, even though the file is exactly where the
 * override model says it is.
 *
 * A vendored checkout has the defaults on disk under `storage/framework`; an
 * installed app has them inside the published `@stacksjs/defaults` package, so
 * both are tried and whichever exists is read.
 */
function listenerRoots(base: string): string[] {
  const roots = [
    join(base, 'app'),
    join(base, 'storage', 'framework', 'defaults', 'app'),
  ]

  try {
    const pkgJson = Bun.resolveSync('@stacksjs/defaults/package.json', base)
    roots.push(join(pkgJson.slice(0, pkgJson.lastIndexOf('/')), 'app'))
  }
  catch {
    // No published defaults package; a vendored checkout has them on disk.
  }

  return roots.filter(root => existsSync(root))
}

/**
 * A listener name, as something callable.
 *
 * Accepts both shapes an application already has: a listener module with
 * `handle`, and an `Action` instance, whose `handle` is the same idea under a
 * different constructor. Refusing actions would break the framework's own
 * default `app/Events.ts`, which names two of them.
 */
async function resolveListener(
  base: string,
  name: string,
): Promise<{ id: string, handle: (_payload: unknown, _event?: string) => unknown, validations?: PayloadValidations } | null> {
  const candidates: string[] = []

  for (const root of listenerRoots(base)) {
    for (const directory of ['Listeners', 'Actions']) {
      for (const extension of ['ts', 'js'])
        candidates.push(join(root, directory, `${name}.${extension}`))
    }
  }

  for (const candidate of candidates) {
    if (!existsSync(candidate))
      continue

    try {
      const mod = await import(candidate)
      const exported = mod?.default ?? mod
      const handle = (exported as { handle?: unknown })?.handle

      if (typeof handle !== 'function')
        continue

      return {
        id: candidate,
        handle: handle.bind(exported) as (_payload: unknown, _event?: string) => unknown,
        validations: (exported as { validations?: PayloadValidations })?.validations,
      }
    }
    catch {
      // Tried the next candidate. The warning for "nothing resolved" is the
      // caller's, so a module that throws on import is reported once rather
      // than once per extension.
      continue
    }
  }

  return null
}
