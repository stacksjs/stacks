/**
 * **Events**
 *
 * This configuration defines all of your events. Because Stacks is fully-typed, you may
 * hover any of the options below and the definitions will be provided. In case you
 * have any questions, feel free to reach out via Discord or GitHub Discussions.
 *
 * @example To fire an event, you may use any of the following approaches:
 * ```ts
 * dispatch('user:registered', { name: 'Chris', email: 'chris@stacksjs.dev' })
 *
 * // alternatively, you may use the following:
 * useEvent('user:registered', { name: 'Chris', email: 'chris@stacksjs.dev' })
 * events.emit('user:registered', { name: 'Chris', email: 'chris@stacksjs.dev' })
 * useEvents.emit('user:registered', { name: 'Chris', email: 'chris@stacksjs.dev' })
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
export interface Events {
  [key: string]: string[]
}
