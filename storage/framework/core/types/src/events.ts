/**
 * **Events**
 *
 * The `app/Events.ts` map, re-exported from `@stacksjs/events` so that the
 * event bus stays the single place an event name is defined. It used to be
 * declared here as `interface Events { [key: string]: string[] }`, which is an
 * index signature over two things that are not open sets: an event name comes
 * from `AppEvents`/`AuthEvents`, and a listener name is a file on disk. Both
 * halves being `string` meant a typo in either one type-checked and then did
 * nothing at runtime, which is the failure mode an event map is least able to
 * report.
 *
 * @example To fire an event, you may use any of the following approaches:
 * ```ts
 * dispatch('user:registered', { name: 'Chris', email: 'chris@stacksjs.com' })
 *
 * // alternatively, you may use the following:
 * useEvent('user:registered', { name: 'Chris', email: 'chris@stacksjs.com' })
 * events.emit('user:registered', { name: 'Chris', email: 'chris@stacksjs.com' })
 * useEvents.emit('user:registered', { name: 'Chris', email: 'chris@stacksjs.com' })
 * ```
 *
 * @example To capture an event, you may use any of the following approaches:
 * ```ts
 * listen('user:registered', (user) => sendWelcomeEmail(user))
 *
 * // alternatively, you may use the following:
 * useListen('user:registered', (user) => sendWelcomeEmail(user))
 * events.on('user:registered', (user) => sendWelcomeEmail(user))
 * useEvents.on('user:registered', (user) => sendWelcomeEmail(user))
 * ```
 */
export type { EventListeners, EventName, Events, ListenerName, StacksEvents } from '@stacksjs/events'
