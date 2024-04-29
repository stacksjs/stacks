import { remove } from '@stacksjs/arrays'

export interface SingletonPromiseReturn<T> {
  (): Promise<T>
  /**
   * Reset current staled promise.
   * Await it to have proper shutdown.
   */
  reset: () => Promise<void>
}

// export { peek } from 'bun'

/**
 * Promise with `resolve` and `reject` methods of itself
 */
export interface ControlledPromise<T = void> extends Promise<T> {
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason?: any) => void
}

/**
 * Create singleton promise function.
 *
 * @category Promise
 */
export function createSingletonPromise<T>(
  fn: () => Promise<T>,
): SingletonPromiseReturn<T> {
  let _promise: Promise<T> | undefined

  function wrapper() {
    if (!_promise) _promise = fn()
    return _promise
  }
  wrapper.reset = async () => {
    const _prev = _promise
    _promise = undefined
    if (_prev) await _prev
  }

  return wrapper
}

/**
 * Create a promise lock.
 *
 * @category Promise
 * @example
 * ```
 * const lock = createPromiseLock()
 *
 * lock.run(async () => {
 *   await doSomething()
 * })
 *
 * // in anther context:
 * await lock.wait() // it will wait all tasking finished
 * ```
 */
export function createPromiseLock() {
  const locks: Promise<any>[] = []

  return {
    async run<T = void>(fn: () => Promise<T>): Promise<T> {
      const p = fn()
      locks.push(p)
      try {
        return await p
      } finally {
        remove(locks, p)
      }
    },
    async wait(): Promise<void> {
      await Promise.allSettled(locks)
    },
    isWaiting() {
      return Boolean(locks.length)
    },
    clear() {
      locks.length = 0
    },
  }
}

/**
 * Return a Promise with `resolve` and `reject` methods
 *
 * @category Promise
 * @example
 * ```
 * const promise = createControlledPromise()
 *
 * await promise
 *
 * // in anther context:
 * promise.resolve(data)
 * ```
 */
export function createControlledPromise<T>(): ControlledPromise<T> {
  let resolve: any
  let reject: any

  const promise = new Promise<T>((_resolve, _reject) => {
    resolve = _resolve
    reject = _reject
  }) as ControlledPromise<T>

  promise.resolve = resolve

  promise.reject = reject
  return promise
}

/**
 * Create a promise that will be resolved after `ms` milliseconds.
 */
// export { sleep, sleepSync } from 'bun'
