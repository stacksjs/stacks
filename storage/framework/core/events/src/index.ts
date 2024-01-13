// thanks to mitt for the base of this wonderful functional event emitter

export type EventType = string | symbol

// An event handler can take an optional event argument
// and should not return a value
export type Handler<T = unknown> = (event: T) => void
export type WildcardHandler<T = Record<string, unknown>> = (
  type: keyof T,
  event: T[keyof T]
) => void

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

  on<Key extends keyof Events>(type: Key, handler: Handler<Events[Key]>): void
  on(type: '*', handler: WildcardHandler<Events>): void

  off<Key extends keyof Events>(type: Key, handler?: Handler<Events[Key]>): void
  off(type: '*', handler: WildcardHandler<Events>): void

  emit<Key extends keyof Events>(type: Key, event: Events[Key]): void
  emit<Key extends keyof Events>(type: undefined extends Events[Key] ? Key : never): void
}

/**
 * A tiny (~200b) functional event emitter / pubsub.
 */
export default function mitt<Events extends Record<EventType, unknown>>(
  all?: EventHandlerMap<Events>,
): Emitter<Events> {
  type GenericEventHandler =
    | Handler<Events[keyof Events]>
    | WildcardHandler<Events>
  all = all || new Map()

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
    on<Key extends keyof Events>(type: Key, handler: GenericEventHandler) {
      const handlers: Array<GenericEventHandler> | undefined = all!.get(type)
      if (handlers)
        handlers.push(handler)

      else
        all!.set(type, [handler] as EventHandlerList<Events[keyof Events]>)
    },

    /**
     * Remove an event handler for the given type.
     * If `handler` is omitted, all handlers of the given type are removed.
     * @param {string|symbol} type Type of event to unregister `handler` from (`'*'` to remove a wildcard handler)
     * @param {Function} [handler] Handler function to remove
     * @memberOf mitt
     */
    off<Key extends keyof Events>(type: Key, handler?: GenericEventHandler) {
      const handlers: Array<GenericEventHandler> | undefined = all!.get(type)
      if (handlers) {
        if (handler)
          handlers.splice(handlers.indexOf(handler) >>> 0, 1)

        else
          all!.set(type, [])
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
      let handlers = all!.get(type)
      if (handlers) {
        (handlers as EventHandlerList<Events[keyof Events]>)
          .slice()
          .map((handler) => {
            if (evt)
              return handler(evt)

            console.error('No event provided')
            return 'No event provided'
          })
      }

      handlers = all!.get('*')
      if (handlers) {
        (handlers as WildCardEventHandlerList<Events>)
          .slice()
        //
          .map((handler: any) => {
            if (evt)
              return handler(type, evt)

            console.error('No event provided')
            return 'No event provided'
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

// TODO: need to create an action that auto generates this Events type from the ./app/events
interface Events {
  'user:registered': { name: string }
  'user:logged-in': { name: string }
  'user:logged-out': { name: string }
  'user:updated': { name: string }
  'user:deleted': { name: string }
  'user:password-reset': { name: string }
  'user:password-changed': { name: string }
}

const events = mitt<Events>
const emitter = events()
const useEvent: typeof emitter.emit = emitter.emit.bind(emitter)
const useEvents = events()
const dispatch: typeof emitter.emit = emitter.emit.bind(emitter)
const listen: typeof emitter.on = emitter.on.bind(emitter)
const off: typeof emitter.off = emitter.off.bind(emitter)
const all: typeof emitter.all = emitter.all

export { all, dispatch, events, listen, mitt, off, useEvent, useEvents }
