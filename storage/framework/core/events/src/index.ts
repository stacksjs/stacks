// thanks to mitt for the base of this wonderful functional event emitter

import type { ModelEvents } from '@stacksjs/types'

export type EventType = string | symbol

// An event handler can take an optional event argument
// and should not return a value
export type Handler<T = unknown> = (_event: T) => void
export type WildcardHandler<T = Record<string, unknown>> = (_type: keyof T, _event: T[keyof T]) => void

// An array of all currently registered event handlers for a type
export type EventHandlerList<T = unknown> = Array<Handler<T>>
export type WildCardEventHandlerList<T = Record<string, unknown>> = Array<WildcardHandler<T>>

// A map of event types and their corresponding event handlers.
export type EventHandlerMap<Events extends Record<EventType, unknown>> = Map<
  keyof Events | '*',
  EventHandlerList<Events[keyof Events]> | WildCardEventHandlerList<Events>
>

export interface Emitter<Events extends Record<EventType, unknown>> {
  all: EventHandlerMap<Events>

  on: (<Key extends keyof Events>(_type: Key, _handler: Handler<Events[Key]>) => void) &
    ((_type: '*', _handler: WildcardHandler<Events>) => void)

  off: (<Key extends keyof Events>(_type: Key, _handler?: Handler<Events[Key]>) => void) &
    ((_type: '*', _handler?: WildcardHandler<Events>) => void)

  emit: (<Key extends keyof Events>(_type: Key, _event: Events[Key]) => void) &
    (<Key extends keyof Events>(_type: undefined extends Events[Key] ? Key : never) => void)
}

/**
 * Tiny (~200b) functional event emitter / pubsub.
 */
export default function mitt<Events extends Record<EventType, unknown>>(
  all?: EventHandlerMap<Events>,
): Emitter<Events> {
  if (!all)
    all = new Map()

  return {
    /**
     * A Map of event names to registered handler functions.
     */
    all,

    /**
     * Register an event handler for the given type.
     * @param {string|symbol} type Type of event to listen for, or `'*'` for all events
     * @param {Function} handler Function to call in response to given event
     * @memberOf mitt
     */
    on<Key extends keyof Events>(type: Key | '*', handler: Handler<Events[Key]> | WildcardHandler<Events>) {
      const handlers: Array<Handler<Events[Key]> | WildcardHandler<Events>> | undefined = (
        all as EventHandlerMap<Events>
      ).get(type)
      if (handlers) {
        handlers.push(handler as Handler<Events[Key]> | WildcardHandler<Events>)
      }
      // Explicitly assert the type of the handler array being set in the map. Unsure if there is a better way to do this
      else {
        (all as EventHandlerMap<Events>).set(type, [handler] as
        | EventHandlerList<Events[keyof Events]>
        | WildCardEventHandlerList<Events>)
      }
    },

    /**
     * Remove an event handler for the given type.
     * If `handler` is omitted, all handlers of the given type are removed.
     * @param {string|symbol} type Type of event to unregister `handler` from (`'*'` to remove a wildcard handler)
     * @param {Function} [handler] Handler function to remove
     * @memberOf mitt
     */
    off<Key extends keyof Events>(type: Key | '*', handler?: Handler<Events[Key]> | WildcardHandler<Events>) {
      const handlers: Array<Handler<Events[Key]> | WildcardHandler<Events>> | undefined = (
        all as EventHandlerMap<Events>
      ).get(type)
      if (handlers) {
        if (handler) {
          const index = handlers.indexOf(handler as Handler<Events[Key]> | WildcardHandler<Events>)
          if (index > -1)
            handlers.splice(index, 1)
        }
        else {
          ;(all as EventHandlerMap<Events>).set(type, [])
        }
      }
    },

    /**
     * Invoke all handlers for the given type.
     * If present, `'*'` handlers are invoked after type-matched handlers.
     *
     * Note: Manually firing '*' handlers is not supported.
     *
     * @param {string|symbol} type The event type to invoke
     * @param {Any} [evt] Any value (object is recommended and powerful), passed to each handler
     * @memberOf mitt
     */
    emit<Key extends keyof Events>(type: Key, evt?: Events[Key]) {
      let handlers = (all as EventHandlerMap<Events>).get(type)

      if (handlers) {
        ;(handlers as EventHandlerList<Events[keyof Events]>).slice().forEach((handler) => {
          try {
            if (evt !== undefined) {
              const result = handler(evt)
              // Async handlers used to silently leak unhandled rejections.
              // Surface them on the same channel as sync errors so the user
              // sees the failure instead of a mystery "unhandledRejection"
              // log with no context about which event/handler was at fault.
              if (result && typeof (result as Promise<unknown>).catch === 'function') {
                (result as Promise<unknown>).catch((err: unknown) => {
                  console.error(`[Events] Async handler error for '${String(type)}':`, err)
                })
              }
            }
          }
          catch (err) {
            console.error(`[Events] Handler error for '${String(type)}':`, err)
          }
        })
      }

      // Pattern matching: fire handlers registered with glob-like patterns (e.g., 'user:*')
      const typeStr = String(type)
      ;(all as EventHandlerMap<Events>).forEach((patternHandlers, key) => {
        const keyStr = String(key)
        // Skip exact matches (already handled) and the '*' wildcard (handled below)
        if (keyStr === typeStr || keyStr === '*') return
        // Check glob patterns like 'user:*' or '*.created'
        if (keyStr.includes('*')) {
          const regex = new RegExp(`^${keyStr.replace(/\*/g, '.*')}$`)
          if (regex.test(typeStr)) {
            ;(patternHandlers as WildCardEventHandlerList<Events>).slice().forEach((handler) => {
              try {
                const result = handler(type, evt as any)
                if (result && typeof (result as Promise<unknown>).catch === 'function') {
                  (result as Promise<unknown>).catch((err: unknown) => {
                    console.error(`[Events] Async pattern handler '${keyStr}' error for '${typeStr}':`, err)
                  })
                }
              }
              catch (err) {
                console.error(`[Events] Pattern handler '${keyStr}' error for '${typeStr}':`, err)
              }
            })
          }
        }
      })

      handlers = (all as EventHandlerMap<Events>).get('*')

      if (handlers) {
        ;(handlers as WildCardEventHandlerList<Events>).slice().forEach((handler) => {
          try {
            if (evt !== undefined)
              handler(type, evt)
          }
          catch (err) {
            console.error(`[Events] Wildcard handler error for '${String(type)}':`, err)
          }
        })
      }
    },
  }
}

/**
 * This module provides a simple, yet powerful, event bus for the application.
 *
 * TODO: https://vitejs.dev/guide/api-plugin.html#typescript-for-custom-events
 *
 * @example To fire an event, you may use any of the following approaches:
 * ```ts
 * useEvent('user:registered', { name: 'Chris'})
 * dispatch('user:registered', { name: 'Chris'})
 *
 * // alternatively, you may use the following:
 * events.emit('user:registered', { name: 'Chris'})
 * useEvents.emit('user:registered', { name: 'Chris'})
 * ````
 *
 * @example To capture an event, you may use any of the following approaches:
 * ```ts
 * useListen('user:registered', (user) => console.log(user))
 * listen('user:registered', (user) => console.log(user))
 * ```
 */

export interface StacksEvents extends ModelEvents, Record<EventType, unknown> {
  'user:registered': Record<string, any>
  'user:logged-in': Record<string, any>
  'user:logged-out': Record<string, any>
  'user:password-reset': Record<string, any>
  'user:password-changed': Record<string, any>
}

const events: Emitter<StacksEvents> = mitt<StacksEvents>()

// Export clean, typed methods
type Dispatch = <Key extends keyof StacksEvents>(type: Key, event: StacksEvents[Key]) => void
type Listen = <Key extends keyof StacksEvents>(type: Key, handler: Handler<StacksEvents[Key]>) => void
type Off = <Key extends keyof StacksEvents>(type: Key, handler?: Handler<StacksEvents[Key]>) => void

const emitter: Emitter<StacksEvents> = events
const useEvents: Emitter<StacksEvents> = events

const dispatch: Dispatch = emitter.emit
const useEvent: Dispatch = dispatch
const all: EventHandlerMap<StacksEvents> = emitter.all
const listen: Listen = emitter.on
const useListen: Listen = emitter.on

const off: Off = emitter.off

export { all, dispatch, emitter, events, listen, mitt, off, useEvent, useEvents, useListen }
