import mitt from 'mitt'

// import type { Events } from '@stacksjs/types'

/**
 * This module provides a simple, yet powerful, event bus for the application.
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

const events = mitt

const emitter = events()

const useEvent = emitter.emit
const dispatch = emitter.emit
const listen = emitter.on
const off = emitter.off
const all = emitter.all

export { useEvent, dispatch, listen, all, off, events, mitt }
