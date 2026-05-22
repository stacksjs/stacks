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

import type { ModelEvents } from '@stacksjs/types'

export type EventType = string | symbol

export type Handler<T = unknown> = (_event: T) => void | Promise<void>
export type WildcardHandler<T = Record<string, unknown>> = (_type: keyof T, _event: T[keyof T]) => void | Promise<void>

export type EventHandlerList<T = unknown> = Array<Handler<T>>
export type WildCardEventHandlerList<T = Record<string, unknown>> = Array<WildcardHandler<T>>

export type EventHandlerMap<Events extends Record<EventType, unknown>> = Map<
  keyof Events | '*',
  EventHandlerList<Events[keyof Events]> | WildCardEventHandlerList<Events>
>

export interface Emitter<Events extends Record<EventType, unknown>> {
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
export function createEmitter<Events extends Record<EventType, unknown>>(
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
      await runAll(map.get(key) as WildcardHandler<any>[] | undefined, true)

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
      await runAll(map.get(key) as WildcardHandler<any>[] | undefined, true)

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
export function scope<Events extends Record<EventType, unknown>>(
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
 * Application-wide event types. Listeners and dispatchers below are
 * pre-typed to this map; user-defined event names land here via
 * `ModelEvents` (model-emitted events) + the explicit auth events listed.
 */
export interface StacksEvents extends ModelEvents, Record<EventType, unknown> {
  'user:registered': UserRegisteredEvent
  'user:logged-in': UserLoggedInEvent
  'user:logged-out': UserLoggedOutEvent
  'user:password-reset': UserPasswordEvent
  'user:password-changed': UserPasswordEvent
}

const events: Emitter<StacksEvents> = createEmitter<StacksEvents>()

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
export { discoverListeners } from './discover'
export type { ListenerModule } from './discover'

// Singleton-friendly scope alias (#1878 E-5). Use to create a
// per-tenant / per-plugin wrapper that auto-prefixes event names.
export function scopedEvents(prefix: string) {
  return scope(events, prefix)
}
