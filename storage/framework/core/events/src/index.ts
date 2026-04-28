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

  /** Register a handler for `type` (or `'*'` for every event, or a glob like `'user:*'`). */
  on: (<Key extends keyof Events>(_type: Key, _handler: Handler<Events[Key]>) => void) &
    ((_type: '*', _handler: WildcardHandler<Events>) => void) &
    ((_type: string, _handler: WildcardHandler<Events>) => void)

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
   */
  emitAsync: <Key extends keyof Events>(_type: Key, _event: Events[Key]) => Promise<unknown[]>

  /** Drop every handler for a type (or every handler everywhere when omitted). */
  removeAllListeners: (_type?: keyof Events | '*') => void

  /** How many handlers are registered for a type — exact match only, no patterns. */
  listenerCount: (_type: keyof Events | '*') => number
}

const ASYNC_HANDLER_TAG = Symbol.for('stacks.events.handler.error')

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

  function on(type: any, handler: any) {
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
    // map (e.g. via `once` removal) doesn't trip iteration.
    const exactHandlers = (map.get(type) as Handler<any>[] | undefined)?.slice()
    const wildcardHandlers = (map.get('*') as WildcardHandler<any>[] | undefined)?.slice()

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
    // (handled separately below) so we don't double-fire.
    const typeStr = String(type)
    map.forEach((patternHandlers, key) => {
      const keyStr = String(key)
      if (keyStr === typeStr || keyStr === '*' || !keyStr.includes('*')) return
      if (matchPattern(keyStr, typeStr)) {
        for (const handler of (patternHandlers as WildcardHandler<any>[]).slice()) {
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
      for (const handler of handlers.slice()) {
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

  return { all: map, on, once, off, emit, emitAsync, removeAllListeners, listenerCount } as Emitter<Events>
}

/**
 * Backward-compatible alias for the legacy `mitt()` export. Behaves
 * identically to {@link createEmitter}.
 */
export const mitt = createEmitter

// Default export keeps `import mitt from '@stacksjs/events'` shape working.
export default createEmitter

/**
 * Application-wide event types. Listeners and dispatchers below are
 * pre-typed to this map; user-defined event names land here via
 * `ModelEvents` (model-emitted events) + the explicit auth events listed.
 */
export interface StacksEvents extends ModelEvents, Record<EventType, unknown> {
  'user:registered': Record<string, any>
  'user:logged-in': Record<string, any>
  'user:logged-out': Record<string, any>
  'user:password-reset': Record<string, any>
  'user:password-changed': Record<string, any>
}

const events: Emitter<StacksEvents> = createEmitter<StacksEvents>()

type Dispatch = <Key extends keyof StacksEvents>(type: Key, event: StacksEvents[Key]) => void
type Listen = <Key extends keyof StacksEvents>(type: Key, handler: Handler<StacksEvents[Key]>) => void
type Off = <Key extends keyof StacksEvents>(type: Key, handler?: Handler<StacksEvents[Key]>) => void
type DispatchAsync = <Key extends keyof StacksEvents>(type: Key, event: StacksEvents[Key]) => Promise<unknown[]>

const emitter: Emitter<StacksEvents> = events
const useEvents: Emitter<StacksEvents> = events

const dispatch: Dispatch = emitter.emit
const dispatchAsync: DispatchAsync = emitter.emitAsync
const useEvent: Dispatch = dispatch
const all: EventHandlerMap<StacksEvents> = emitter.all
const listen: Listen = emitter.on
const useListen: Listen = emitter.on
const once: Listen = emitter.once
const off: Off = emitter.off

export {
  all,
  dispatch,
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
