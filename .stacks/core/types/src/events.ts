/**
 * **Events**
 *
 * This configuration defines all of your events. Because Stacks is fully-typed, you may
 * hover any of the options below and the definitions will be provided. In case you
 * have any questions, feel free to reach out via Discord or GitHub Discussions.
 *
 * @example To fire an event, you may use any of the following approaches:
 * ```ts
 * useEvent('user:registered', { name: 'Chris'})
 * dispatch('user:registered', { name: 'Chris'})
 * ````

 * @example To capture an event, you may use any of the following approaches:
 * ```ts
 * useListen('user:registered', (user) => console.log(user))
 * listen('user:registered', (user) => console.log(user))
 * ```
 */
export interface Events {
  [key: string]: any
}
