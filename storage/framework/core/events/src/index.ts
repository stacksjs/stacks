/**
 * Stacks event engine — a native, type-safe, async-aware pub/sub.
 *
 * Originally adapted from `mitt`; rewritten in-house to:
 *   - Surface async handler errors on the same channel as sync ones
 *     (mitt swallowed unhandled rejections)
 *   - Support glob patterns (`user:*`, `*.created`) alongside `'*'` wildcard
 *   - Add `once`, `removeAllListeners`, `listenerCount` for parity with
 *     Node's EventEmitter ergonomics
 *   - Add `dispatchAsync` that AWAITS handlers and returns their results,
 *     so callers can express "fire this event AND wait until every
 *     listener finishes" (booking:cancelled → wait for refund + email
 *     before responding to the user)
 *
 * The legacy `mitt` export is preserved for backward compat — calling it
 * gets you the same emitter you'd get from `createEmitter()`.
 */


export type EventType = string | symbol

/**
 * An event listener.
 *
 * `false` is part of the contract, not a leak: `dispatchBeforeEvent` in the ORM
 * awaits every handler and cancels the write if any returned exactly `false` -
 * which is how `'user:saving'` refuses a save. The type said `void`, so the
 * documented way to cancel one did not compile and the only way to write it was
 * to annotate around the type.
 *
 * Anything else a handler returns is ignored, as before.
 */
/**
 * A map of event name to payload.
 *
 * `Record<EventType, unknown>` was the constraint, and it requires an index
 * signature - which a precise event map deliberately does not have, because an
 * index signature is exactly what made every misspelled event name legal. The
 * constraint only ever needed the keys to be event names.
 */
export type EventMap = object

export type Handler<T = unknown> = (_event: T) => void | false | Promise<void | false>
/** The same contract as {@link Handler}, for a listener registered on `'*'`. */
export type WildcardHandler<T = Record<string, unknown>> = (_type: keyof T, _event: T[keyof T]) => void | false | Promise<void | false>

export type EventHandlerList<T = unknown> = Array<Handler<T>>
export type WildCardEventHandlerList<T = Record<string, unknown>> = Array<WildcardHandler<T>>

export type EventHandlerMap<Events extends EventMap> = Map<
  keyof Events | '*',
  EventHandlerList<Events[keyof Events]> | WildCardEventHandlerList<Events>
>

export interface Emitter<Events extends EventMap> {
  /** Underlying handler map. Mutating it directly is supported but rarely needed. */
  all: EventHandlerMap<Events>

  /**
   * Register a handler for `type` (or `'*'` for every event, or a
   * glob like `'user:*'`). Optional `{ priority }` controls dispatch
   * order — higher runs first, default 0
   * (stacksjs/stacks#1878 E-2).
   */
  on: (<Key extends keyof Events>(_type: Key, _handler: Handler<Events[Key]>, _options?: { priority?: number }) => void) &
    ((_type: '*', _handler: WildcardHandler<Events>, _options?: { priority?: number }) => void) &
    ((_type: string, _handler: WildcardHandler<Events>, _options?: { priority?: number }) => void)

  /** Register a handler that auto-removes after the first invocation. */
  once: (<Key extends keyof Events>(_type: Key, _handler: Handler<Events[Key]>) => void) &
    ((_type: '*', _handler: WildcardHandler<Events>) => void)

  /** Remove a single handler, or every handler for a type when handler is omitted. */
  off: (<Key extends keyof Events>(_type: Key, _handler?: Handler<Events[Key]>) => void) &
    ((_type: '*', _handler?: WildcardHandler<Events>) => void) &
    ((_type: string, _handler?: WildcardHandler<Events>) => void)

  /** Fire-and-forget. Async handler errors are logged but never propagated. */
  emit: (<Key extends keyof Events>(_type: Key, _event: Events[Key]) => void) &
    (<Key extends keyof Events>(_type: undefined extends Events[Key] ? Key : never) => void)

  /**
   * Awaitable dispatch — resolves once every matching handler (exact +
   * pattern + wildcard) has finished. Use when downstream work has to
   * complete before the caller continues (e.g. a booking cancel that
   * must persist + refund + notify before returning a 200).
   *
   * Errors are LOGGED but swallowed into the results array as
   * `undefined`. Use `emitAndCollect` when you need to inspect them.
   */
  emitAsync: <Key extends keyof Events>(_type: Key, _event: Events[Key]) => Promise<unknown[]>

  /**
   * Like `emitAsync` but returns per-handler `Result<T, Error>` so
   * callers can inspect partial failures. Use when downstream work
   * must be observable — e.g. fan-out where some sinks might fail
   * but the call shouldn't throw (stacksjs/stacks#1878 E-1).
   */
  emitAndCollect: <Key extends keyof Events>(_type: Key, _event: Events[Key]) => Promise<Array<{ ok: true, value: unknown } | { ok: false, error: Error }>>

  /** Drop every handler for a type (or every handler everywhere when omitted). */
  removeAllListeners: (_type?: keyof Events | '*') => void

  /** How many handlers are registered for a type — exact match only, no patterns. */
  listenerCount: (_type: keyof Events | '*') => number
}

const ASYNC_HANDLER_TAG = Symbol.for('stacks.events.handler.error')
/**
 * Symbol attached to handlers registered with an explicit priority
 * (stacksjs/stacks#1878 E-2). Listeners with higher priorities run
 * before lower ones; default priority is 0. The tag-on-function
 * approach keeps the existing `off()` identity comparisons working
 * — `handler === otherHandler` still holds, the priority is just
 * an extra annotation.
 */
const HANDLER_PRIORITY = Symbol.for('stacks.events.handler.priority')

/**
 * Read a handler's priority. Defaults to 0 for handlers registered
 * without an explicit priority (the pre-fix behavior).
 */
function priorityOf(handler: unknown): number {
  if (handler && typeof handler === 'object' || typeof handler === 'function') {
    const p = (handler as Record<symbol, unknown>)[HANDLER_PRIORITY]
    return typeof p === 'number' && Number.isFinite(p) ? p : 0
  }
  return 0
}

/**
 * Sort a handler array by priority descending (higher runs first).
 * Stable so handlers with the same priority preserve insertion order
 * — matters for the "audit log fires after the change but before
 * analytics" case where ordering within a priority bucket is
 * load-bearing.
 */
function sortByPriority<T>(handlers: T[]): T[] {
  // Decorate-sort-undecorate keeps the sort stable (Array.sort is
  // stable in modern engines but the decorate avoids relying on it).
  return handlers
    .map((h, i) => ({ h, i, p: priorityOf(h) }))
    .sort((a, b) => b.p - a.p || a.i - b.i)
    .map(x => x.h)
}

function logAsyncError(label: string, type: EventType, err: unknown) {
  // eslint-disable-next-line no-console
  console.error(`[Events] ${label} for '${String(type)}':`, err)
}

function isPromiseLike(v: unknown): v is Promise<unknown> {
  return !!v && typeof (v as Promise<unknown>).catch === 'function'
}

/**
 * Create a fresh Stacks event emitter. Most consumers want the singleton
 * exported below — call this directly only when you need an isolated bus
 * (tests, child workers, plugin sandboxes).
 */
// eslint-disable-next-line pickier/no-unused-vars
export function createEmitter<Events extends EventMap>(
  all?: EventHandlerMap<Events>,
): Emitter<Events> {
  const map = all ?? new Map<keyof Events | '*', any>()

  // Match a glob-pattern key (`user:*`, `*.created`) against a concrete event
  // type. Compiled regexes are cached on the key string so the hot path
  // doesn't recompile on every emit.
  const patternCache = new Map<string, RegExp>()
  const matchPattern = (key: string, type: string): boolean => {
    let re = patternCache.get(key)
    if (!re) {
      // Preserve mitt's loose semantics: `*` is a glob (any chars) and
      // every other char is treated as a literal regex char. We do NOT
      // escape `.` because users in the wild rely on patterns like
      // `*.created` matching `user:created` / `post-created` / etc.
      // (treating `.` as "any char", not literal dot).
      re = new RegExp(`^${key.replace(/\*/g, '.*')}$`)
      patternCache.set(key, re)
    }
    return re.test(type)
  }

  function on(type: any, handler: any, options?: { priority?: number }) {
    // Stamp priority on the handler (stacksjs/stacks#1878 E-2). The
    // sort happens at emit-time, not register-time, so two handlers
    // registered with different priorities still keep their original
    // identity for `off()` comparisons.
    if (options?.priority !== undefined && Number.isFinite(options.priority))
      (handler as Record<symbol, number>)[HANDLER_PRIORITY] = options.priority
    const list = map.get(type)
    if (list) list.push(handler)
    else map.set(type, [handler])
  }

  function once(type: any, handler: any) {
    const wrapped: any = (...args: any[]) => {
      off(type, wrapped)
      return handler(...args)
    }
    // Tag so off-by-original-handler still works when caller stashed the
    // original reference. Maintain a back-pointer for lookup.
    wrapped[ASYNC_HANDLER_TAG] = handler
    on(type, wrapped)
  }

  function off(type: any, handler?: any) {
    const list = map.get(type)
    if (!list) return
    if (!handler) {
      map.set(type, [])
      return
    }
    for (let i = list.length - 1; i >= 0; i--) {
      const h = list[i] as any
      if (h === handler || h?.[ASYNC_HANDLER_TAG] === handler) list.splice(i, 1)
    }
  }

  function removeAllListeners(type?: keyof Events | '*') {
    if (type === undefined) map.clear()
    else map.delete(type)
  }

  function listenerCount(type: keyof Events | '*'): number {
    return map.get(type)?.length ?? 0
  }

  function emit(type: any, evt?: any) {
    // Snapshot the relevant handler arrays so a handler that mutates the
    // map (e.g. via `once` removal) doesn't trip iteration. Sort by
    // priority (stacksjs/stacks#1878 E-2) — higher runs first; same
    // priority preserves insertion order via stable sort.
    const exactRaw = (map.get(type) as Handler<any>[] | undefined)?.slice()
    const wildcardRaw = (map.get('*') as WildcardHandler<any>[] | undefined)?.slice()
    const exactHandlers = exactRaw ? sortByPriority(exactRaw) : undefined
    const wildcardHandlers = wildcardRaw ? sortByPriority(wildcardRaw) : undefined

    if (exactHandlers) {
      for (const handler of exactHandlers) {
        try {
          // No undefined-skip — events with no payload (e.g. signals like
          // `ping`, `ready`) are first-class. The previous `if (evt !==
          // undefined)` guard inherited from mitt silently dropped those.
          const result = handler(evt)
          if (isPromiseLike(result))
            result.catch(err => logAsyncError(`Async handler error`, type, err))
        }
        catch (err) {
          logAsyncError(`Handler error`, type, err)
        }
      }
    }

    // Pattern match: 'user:*', '*.created', etc. Skip exact + literal '*'
    // (handled separately below) so we don't double-fire. Pattern
    // handlers are also priority-sorted (#1878 E-2).
    const typeStr = String(type)
    map.forEach((patternHandlers, key) => {
      const keyStr = String(key)
      if (keyStr === typeStr || keyStr === '*' || !keyStr.includes('*')) return
      if (matchPattern(keyStr, typeStr)) {
        for (const handler of sortByPriority((patternHandlers as WildcardHandler<any>[]).slice())) {
          try {
            const result = handler(type, evt)
            if (isPromiseLike(result))
              result.catch(err => logAsyncError(`Async pattern handler '${keyStr}' error`, type, err))
          }
          catch (err) {
            logAsyncError(`Pattern handler '${keyStr}' error`, type, err)
          }
        }
      }
    })

    if (wildcardHandlers) {
      for (const handler of wildcardHandlers) {
        try {
          const result = handler(type, evt)
          if (isPromiseLike(result))
            result.catch(err => logAsyncError(`Async wildcard handler error`, type, err))
        }
        catch (err) {
          logAsyncError(`Wildcard handler error`, type, err)
        }
      }
    }
  }

  async function emitAsync(type: any, evt?: any): Promise<unknown[]> {
    const results: unknown[] = []

    const runAll = async (handlers: Handler<any>[] | WildcardHandler<any>[] | undefined, isWildcard: boolean) => {
      if (!handlers) return
      for (const handler of sortByPriority(handlers.slice())) {
        try {
          const result = isWildcard ? (handler as WildcardHandler<any>)(type, evt) : (handler as Handler<any>)(evt)
          results.push(isPromiseLike(result) ? await result : result)
        }
        catch (err) {
          logAsyncError(`Awaited handler error`, type, err)
          results.push(undefined)
        }
      }
    }

    await runAll(map.get(type) as Handler<any>[] | undefined, false)

    const typeStr = String(type)
    const patternKeys: string[] = []
    map.forEach((_, key) => {
      const keyStr = String(key)
      if (keyStr === typeStr || keyStr === '*' || !keyStr.includes('*')) return
      if (matchPattern(keyStr, typeStr)) patternKeys.push(keyStr)
    })
    for (const key of patternKeys)
      // `patternKeys` are matched at runtime, so they are strings rather than
      // members of the event union - the map is keyed on the union.
      await runAll(map.get(key as keyof Events) as WildcardHandler<any>[] | undefined, true)

    await runAll(map.get('*') as WildcardHandler<any>[] | undefined, true)

    return results
  }

  /**
   * Variant of `emitAsync` that returns per-handler `Result<T, Error>`
   * so callers can inspect partial failures
   * (stacksjs/stacks#1878 E-1). Pre-fix the only "I want to know what
   * happened" emit path was `emitAsync` which swallowed failures into
   * `undefined` — callers couldn't tell a returned `undefined` from
   * an error.
   *
   * @example
   * ```ts
   * const results = await emitAndCollect('booking:cancelled', payload)
   * const failed = results.filter(r => !r.ok)
   * if (failed.length > 0) alertSlack({ payload, failed })
   * ```
   */
  async function emitAndCollect(type: any, evt?: any): Promise<Array<{ ok: true, value: unknown } | { ok: false, error: Error }>> {
    const results: Array<{ ok: true, value: unknown } | { ok: false, error: Error }> = []

    const runAll = async (handlers: Handler<any>[] | WildcardHandler<any>[] | undefined, isWildcard: boolean) => {
      if (!handlers) return
      for (const handler of sortByPriority(handlers.slice())) {
        try {
          const result = isWildcard ? (handler as WildcardHandler<any>)(type, evt) : (handler as Handler<any>)(evt)
          const value = isPromiseLike(result) ? await result : result
          results.push({ ok: true, value })
        }
        catch (err) {
          const error = err instanceof Error ? err : new Error(String(err))
          results.push({ ok: false, error })
        }
      }
    }

    await runAll(map.get(type) as Handler<any>[] | undefined, false)

    const typeStr = String(type)
    const patternKeys: string[] = []
    map.forEach((_, key) => {
      const keyStr = String(key)
      if (keyStr === typeStr || keyStr === '*' || !keyStr.includes('*')) return
      if (matchPattern(keyStr, typeStr)) patternKeys.push(keyStr)
    })
    for (const key of patternKeys)
      // `patternKeys` are matched at runtime, so they are strings rather than
      // members of the event union - the map is keyed on the union.
      await runAll(map.get(key as keyof Events) as WildcardHandler<any>[] | undefined, true)

    await runAll(map.get('*') as WildcardHandler<any>[] | undefined, true)

    return results
  }

  return { all: map, on, once, off, emit, emitAsync, emitAndCollect, removeAllListeners, listenerCount } as Emitter<Events>
}

/**
 * Backward-compatible alias for the legacy `mitt()` export. Behaves
 * identically to {@link createEmitter}.
 */
export const mitt = createEmitter

// Default export keeps `import mitt from '@stacksjs/events'` shape working.
export default createEmitter

/**
 * Build a scoped wrapper around an emitter (stacksjs/stacks#1878 E-5).
 * Every dispatch and listen call is prefixed with `${prefix}:` so
 * different tenants / plugins / subsystems can share the same
 * underlying bus without colliding on event names.
 *
 * Listeners registered through the scoped wrapper only receive events
 * dispatched through the SAME wrapper — they don't see unprefixed
 * events on the underlying bus. Apps that need to subscribe across
 * scopes use the underlying emitter directly with a glob pattern.
 *
 * @example
 * ```ts
 * import { events, scope } from '@stacksjs/events'
 *
 * const tenantA = scope(events, 'tenant:42')
 * tenantA.on('user:created', user => sendWelcome(user))
 * tenantA.emit('user:created', { id: 1 })
 * // ↑ fires the listener; on the underlying bus the event is
 * // emitted as 'tenant:42:user:created'.
 *
 * // Listener on the raw bus DOES see the prefixed form:
 * events.on('tenant:42:user:created', auditTrail)
 * // Listener on the raw bus DOES NOT see the bare 'user:created' —
 * // the prefix is mandatory.
 * ```
 */
export function scope<Events extends EventMap>(
  underlying: Emitter<Events>,
  prefix: string,
): {
  on: (type: string, handler: Handler<unknown>, options?: { priority?: number }) => void
  once: (type: string, handler: Handler<unknown>) => void
  off: (type: string, handler?: Handler<unknown>) => void
  emit: (type: string, event: unknown) => void
  emitAsync: (type: string, event: unknown) => Promise<unknown[]>
  emitAndCollect: (type: string, event: unknown) => Promise<Array<{ ok: true, value: unknown } | { ok: false, error: Error }>>
  listenerCount: (type: string) => number
} {
  const scopedType = (type: string): string => `${prefix}:${type}`
  return {
    on(type, handler, options) {
      ;(underlying.on as (t: string, h: any, o?: any) => void)(scopedType(type), handler, options)
    },
    once(type, handler) {
      ;(underlying.once as (t: string, h: any) => void)(scopedType(type), handler)
    },
    off(type, handler) {
      ;(underlying.off as (t: string, h?: any) => void)(scopedType(type), handler)
    },
    emit(type, event) {
      ;(underlying.emit as (t: string, e?: any) => void)(scopedType(type), event)
    },
    emitAsync(type, event) {
      return (underlying.emitAsync as (t: string, e?: any) => Promise<unknown[]>)(scopedType(type), event)
    },
    emitAndCollect(type, event) {
      return (underlying.emitAndCollect as (t: string, e?: any) => Promise<any>)(scopedType(type), event)
    },
    listenerCount(type) {
      return (underlying.listenerCount as (t: string) => number)(scopedType(type))
    },
  }
}

/**
 * Concrete payload shape for the auth-related events. Keeping these
 * narrow (instead of `Record<string, any>`) means listeners don't need to
 * cast or guess what fields are present — the handler signature reflects
 * what RegisterAction / LoginAction actually dispatch.
 */
export interface UserRegisteredEvent {
  id?: number | string
  email: string
  name?: string
  /** Convenience alias of `email` for SendWelcomeEmail-style listeners. */
  to?: string
}

export interface UserLoggedInEvent {
  id: number | string
  email: string
}

export interface UserLoggedOutEvent {
  id: number | string
}

export interface UserPasswordEvent {
  id: number | string
  email: string
}

/**
 * What an application declares about its own events.
 *
 * Model events are the bulk of them and their payloads are the model rows,
 * which only the application's own compilation can name. `@stacksjs/types`
 * cannot carry them: it is reached by the ORM's type-test project, where naming
 * a model drags all 97 model modules into a compilation that resolves
 * `@stacksjs/orm` to a built dist and cannot compile them at all.
 *
 * So the precise map is generated into the application's declarations
 * (`storage/framework/types/model-events.d.ts`, written by
 * `buddy generate:types`) and augments this:
 *
 * ```ts
 * declare module '@stacksjs/events' {
 *   interface AppEvents {
 *     'user:created': ModelRow<typeof User>
 *   }
 * }
 * ```
 *
 * Declare your own events the same way. An application that declares nothing
 * keeps exactly the behaviour it had before.
 */
// eslint-disable-next-line ts/no-empty-object-type -- augmentation target; empty by design
export interface AppEvents {}

/**
 * Application-wide event types. Listeners and dispatchers below are
 * pre-typed to this map; user-defined event names land here via
 * `ModelEvents` (model-emitted events) + the explicit auth events listed.
 */
export interface AuthEvents {
  'user:registered': UserRegisteredEvent
  'user:logged-in': UserLoggedInEvent
  'user:logged-out': UserLoggedOutEvent
  'user:password-reset': UserPasswordEvent
  'user:password-changed': UserPasswordEvent
}

/**
 * Application-wide event types, in precedence order.
 *
 * `ModelEvents` from `@stacksjs/types` is deliberately NOT in here. It was
 * hand-maintained, and it named its events in kebab-case - `'cart-item:created'`
 * - while `define-model.ts` dispatches `definition.name.toLowerCase()`, which
 * for a model named `CartItem` is `'cartitem:created'`. Every compound-named
 * model therefore had a documented, type-checked event that is never emitted:
 * `listen('cart-item:created', …)` compiled and could not fire. `AppEvents` is
 * derived from the models themselves and gets the name right, so keeping the
 * old map in the union would only re-admit the 130-odd names that do not exist.
 *
 * There is no trailing index signature, deliberately. One used to be here, and
 * it made every event name legal: `dispatch('user:creatd', …)` type-checked and
 * reached nobody, which is the failure an event bus is most prone to and least
 * able to report - a dispatch to a name nothing listens for looks exactly like
 * a dispatch that had nothing to do. Declare an application's own events on
 * `AppEvents` and the typo becomes a compile error.
 */
export type StacksEvents = AppEvents & AuthEvents

/**
 * Every event name this application can dispatch or listen for.
 *
 * `& string` because `keyof` on an object type also yields `number | symbol`
 * for an index signature, and an event name in `app/Events.ts` is a string key.
 */
export type EventName = keyof StacksEvents & string

/**
 * Augmentation target: every listener name `app/Events.ts` may reference.
 *
 * The keys are listener names as they are written in the map - `'NotifyUser'`,
 * `'Auth/LoginAction'` - which is a name relative to `app/Listeners/` or
 * `app/Actions/` (or the framework defaults behind them), without the
 * extension. `buddy generate:types` writes the augmentation into
 * `storage/framework/types/actions.d.ts`, from the same directories
 * `resolveListener` searches at runtime, so the type and the resolution cannot
 * disagree about what exists.
 *
 * An interface rather than a union alias because a union cannot be reopened,
 * and this one has to be: the framework declares it empty and the application's
 * generated declarations fill it in.
 *
 * @example
 * ```ts
 * declare module '@stacksjs/events' {
 *   interface EventListeners {
 *     'SendWelcomeEmail': true
 *   }
 * }
 * ```
 */
// eslint-disable-next-line ts/no-empty-object-type -- augmentation target; empty by design
export interface EventListeners {}

/**
 * A listener name, as narrow as the application has made it.
 *
 * Falls back to `string` while `EventListeners` is empty. That is not a
 * loophole left open: `generate:types` has not run yet in a project that has
 * just been created, and rejecting every listener name until it does would make
 * a fresh app fail to compile over a file it has never been told to generate.
 * Once the registry exists, a misspelled listener is a compile error.
 */
export type ListenerName = keyof EventListeners extends never
  ? string
  : keyof EventListeners & string

/**
 * The `app/Events.ts` map: an event name to the listeners that handle it.
 *
 * Both halves are checked. The key must be an event that exists - a name only
 * `AppEvents` or `AuthEvents` declares - and the value must name listeners that
 * are on disk. Neither used to be: the type was `{ [key: string]: string[] }`,
 * which accepts `{ 'user:registerd': ['SendWelcomEmail'] }` in full, and both
 * halves of that fail at runtime by doing nothing at all.
 */
export type Events = {
  readonly [K in EventName]?: readonly ListenerName[]
}

/**
 * Define the application's event-to-listener map, with the literal names kept.
 *
 * Identical in effect to `satisfies Events`, and preferred for the same reason
 * every other `define*` helper in the framework is: the constraint is applied
 * where the object is written, so the error points at the misspelled event name
 * rather than at whatever consumed the map later.
 *
 * `const` on the type parameter is what makes it *narrower* than `satisfies`:
 * the returned type keeps `readonly ['SendWelcomeEmail']` rather than widening
 * to `ListenerName[]`, so `keyof typeof events` and `events['user:registered']`
 * are exactly what the file declares.
 *
 * @example
 * ```ts
 * // app/Events.ts
 * import { defineEvents } from '@stacksjs/events'
 *
 * export default defineEvents({
 *   'user:registered': ['SendWelcomeEmail'],
 *   'user:created': ['NotifyUser'],
 * })
 * ```
 *
 * The `Record<Exclude<keyof T, EventName>, never>` half of the constraint is
 * what rejects an event name that does not exist, and it is not redundant with
 * `Events`. Excess-property checking is a freshness rule on the object literal,
 * and it stops applying as soon as inference has something to work with: a map
 * of one bad key is caught by it, and the same bad key sitting next to one good
 * one is not, because `T` infers happily and a type with extra properties is
 * assignable to a mapped type whose keys are all optional. Requiring every key
 * outside `EventName` to hold something no listener list can be makes the check
 * structural, so it holds however many entries the map has - and the shape it
 * demands is an object with one impossible property, so the compiler's message
 * is the sentence naming the fix rather than `not assignable to never`.
 */
export function defineEvents<
  const T extends Events & Record<
    Exclude<keyof T, EventName>,
    { 'this event name is not declared on AppEvents or AuthEvents': never }
  >,
>(events: T): T {
  return events
}

/**
 * The application's emitter, one per *process* rather than one per copy of this
 * package.
 *
 * A module-level `createEmitter()` makes the emitter a singleton of the module,
 * and a module is only a singleton if there is exactly one copy of it. There
 * routinely is not: an app depending on `@stacksjs/events` alongside `stacks`
 * and `@stacksjs/buddy`, each with their own range, installs two or three, and
 * bun hoists one while the others sit nested. Every copy is a separate emitter.
 *
 * Nothing errors when that happens, which is what makes it dangerous rather
 * than merely wasteful: the boot that registers listeners imports one copy, the
 * code that dispatches imports another, and the dispatch returns normally
 * having reached nobody. There is no error, no warning, and no way to tell the
 * outcome apart from "nothing was listening".
 *
 * It is easy to be sure this has happened when it has not - the same symptom
 * appears when a *probe* is loaded from outside the application's resolution
 * root, and that is a mistake in the probe. What is not in question is that the
 * hazard is real whenever more than one copy is installed, and that no consumer
 * can be expected to notice it.
 *
 * Keyed on a `Symbol.for`, so the shared slot is the same one whichever copy
 * gets there first and no copy can shadow another with its own property.
 */
const EMITTER_SLOT = Symbol.for('stacks.events.emitter')

interface EmitterHost {
  [EMITTER_SLOT]?: Emitter<StacksEvents>
}

const host = globalThis as unknown as EmitterHost

const events: Emitter<StacksEvents> = host[EMITTER_SLOT] ?? (host[EMITTER_SLOT] = createEmitter<StacksEvents>())

type Dispatch = <Key extends keyof StacksEvents>(_type: Key, _event: StacksEvents[Key]) => void
// eslint-disable-next-line pickier/no-unused-vars
type Listen = <Key extends keyof StacksEvents>(_type: Key, _handler: Handler<StacksEvents[Key]>, _options?: { priority?: number }) => void
// eslint-disable-next-line pickier/no-unused-vars
type Off = <Key extends keyof StacksEvents>(_type: Key, handler?: Handler<StacksEvents[Key]>) => void
type DispatchAsync = <Key extends keyof StacksEvents>(_type: Key, _event: StacksEvents[Key]) => Promise<unknown[]>
type DispatchAndCollect = <Key extends keyof StacksEvents>(_type: Key, _event: StacksEvents[Key]) => Promise<Array<{ ok: true, value: unknown } | { ok: false, error: Error }>>

const emitter: Emitter<StacksEvents> = events
const useEvents: Emitter<StacksEvents> = events

const dispatch: Dispatch = emitter.emit
const dispatchAsync: DispatchAsync = emitter.emitAsync
const dispatchAndCollect: DispatchAndCollect = emitter.emitAndCollect
const useEvent: Dispatch = dispatch
const all: EventHandlerMap<StacksEvents> = emitter.all
const listen: Listen = emitter.on
const useListen: Listen = emitter.on
const once: Listen = emitter.once
const off: Off = emitter.off

export {
  all,
  dispatch,
  dispatchAndCollect,
  dispatchAsync,
  emitter,
  events,
  listen,
  off,
  once,
  useEvent,
  useEvents,
  useListen,
}

// Boot-time listener auto-discovery (stacksjs/stacks#1878 E-3,
// closing F-3 from #1874). Scans `app/Listeners/**/*.ts` for
// default-exported `{ listensTo, handle }` modules and registers them.
export { defineListener, discoverListeners, registerAppListeners, resetListenerRegistry } from './discover'
export type { EventSubscription, ListenerModule, SubscriptionPayload } from './discover'

// Singleton-friendly scope alias (#1878 E-5). Use to create a
// per-tenant / per-plugin wrapper that auto-prefixes event names.
export function scopedEvents(prefix: string) {
  return scope(events, prefix)
}
