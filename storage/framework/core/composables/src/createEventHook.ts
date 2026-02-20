export interface EventHookOn<T = any> {
  on: (fn: (param: T) => void) => { off: () => void }
  off: (fn: (param: T) => void) => void
  trigger: (param: T) => void
}

/**
 * Create a typed event hook that can be triggered and subscribed to.
 *
 * @example
 * ```ts
 * const onFetch = createEventHook<Response>()
 * onFetch.on((response) => console.log(response))
 * onFetch.trigger(new Response())
 * ```
 */
export function createEventHook<T = any>(): EventHookOn<T> {
  const fns = new Set<(param: T) => void>()

  function on(fn: (param: T) => void): { off: () => void } {
    fns.add(fn)
    return { off: () => fns.delete(fn) }
  }

  function off(fn: (param: T) => void): void {
    fns.delete(fn)
  }

  function trigger(param: T): void {
    for (const fn of fns)
      fn(param)
  }

  return { on, off, trigger }
}
