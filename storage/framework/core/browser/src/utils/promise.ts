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
export function createSingletonPromise<T>(fn: () => Promise<T>): SingletonPromiseReturn<T> {
  let _promise: Promise<T> | undefined

  function wrapper() {
    if (!_promise)
      _promise = fn()
    return _promise
  }

  wrapper.reset = async () => {
    const _prev = _promise
    _promise = undefined
    if (_prev)
      await _prev
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
  let currentPromise = Promise.resolve()
  const queue: Promise<any>[] = []

  return {
    async run<T = void>(fn: () => Promise<T>): Promise<T> {
      const runTask = async (): Promise<T> => {
        await currentPromise
        return fn()
      }

      const taskPromise = runTask()
      queue.push(taskPromise)

      currentPromise = taskPromise
        .catch(() => {})
        .finally(() => {
          const index = queue.indexOf(taskPromise)
          if (index > -1)
            queue.splice(index, 1)
        }) as Promise<void>

      return taskPromise
    },

    async wait(): Promise<void> {
      while (queue.length > 0) {
        await Promise.all(queue)
      }
    },

    isWaiting(): boolean {
      return queue.length > 0
    },

    clear(): void {
      queue.length = 0
      currentPromise = Promise.resolve()
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
