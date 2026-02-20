import type { Ref } from '@stacksjs/stx'
import { watch } from '@stacksjs/stx'

export interface UntilToMatchOptions {
  /**
   * Timeout in milliseconds. If the condition is not met within this time,
   * the promise rejects.
   */
  timeout?: number
  /**
   * Whether to throw an error on timeout. Default: false (resolves undefined).
   */
  throwOnTimeout?: boolean
}

export interface UntilBaseInstance<T> {
  toMatch: (condition: (v: T) => boolean, options?: UntilToMatchOptions) => Promise<T>
  toBe: (value: T, options?: UntilToMatchOptions) => Promise<T>
  toBeTruthy: (options?: UntilToMatchOptions) => Promise<T>
  toBeNull: (options?: UntilToMatchOptions) => Promise<T>
  toBeUndefined: (options?: UntilToMatchOptions) => Promise<T>
  toBeNaN: (options?: UntilToMatchOptions) => Promise<T>
  changed: (options?: UntilToMatchOptions) => Promise<T>
  not: {
    toBe: (value: T, options?: UntilToMatchOptions) => Promise<T>
    toBeTruthy: (options?: UntilToMatchOptions) => Promise<T>
    toBeNull: (options?: UntilToMatchOptions) => Promise<T>
    toBeUndefined: (options?: UntilToMatchOptions) => Promise<T>
    toBeNaN: (options?: UntilToMatchOptions) => Promise<T>
  }
}

/**
 * Promise-based utility to wait for a ref to meet a condition.
 *
 * @param r - The reactive ref to watch
 * @returns A chainable instance with condition methods
 *
 * @example
 * ```ts
 * const ready = ref(false)
 * await until(ready).toBe(true)
 * ```
 */
export function until<T>(r: Ref<T>): UntilBaseInstance<T> {
  function toMatch(condition: (v: T) => boolean, options: UntilToMatchOptions = {}): Promise<T> {
    const { timeout, throwOnTimeout = false } = options

    // Check immediately
    if (condition(r.value))
      return Promise.resolve(r.value)

    return new Promise<T>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | null = null

      const unwatch = watch(r, (newVal) => {
        if (condition(newVal)) {
          unwatch()
          if (timer !== null)
            clearTimeout(timer)
          resolve(newVal)
        }
      })

      if (timeout !== undefined) {
        timer = setTimeout(() => {
          unwatch()
          if (throwOnTimeout)
            reject(new Error('Timeout'))
          else
            resolve(r.value)
        }, timeout)
      }
    })
  }

  function toBe(value: T, options?: UntilToMatchOptions): Promise<T> {
    return toMatch(v => v === value, options)
  }

  function toBeTruthy(options?: UntilToMatchOptions): Promise<T> {
    return toMatch(v => Boolean(v), options)
  }

  function toBeNull(options?: UntilToMatchOptions): Promise<T> {
    return toMatch(v => v === null, options)
  }

  function toBeUndefined(options?: UntilToMatchOptions): Promise<T> {
    return toMatch(v => v === undefined, options)
  }

  function toBeNaN(options?: UntilToMatchOptions): Promise<T> {
    return toMatch(v => Number.isNaN(v as any), options)
  }

  function changed(options?: UntilToMatchOptions): Promise<T> {
    const initial = r.value
    return toMatch(v => v !== initial, options)
  }

  return {
    toMatch,
    toBe,
    toBeTruthy,
    toBeNull,
    toBeUndefined,
    toBeNaN,
    changed,
    not: {
      toBe: (value: T, options?: UntilToMatchOptions) => toMatch(v => v !== value, options),
      toBeTruthy: (options?: UntilToMatchOptions) => toMatch(v => !v, options),
      toBeNull: (options?: UntilToMatchOptions) => toMatch(v => v !== null, options),
      toBeUndefined: (options?: UntilToMatchOptions) => toMatch(v => v !== undefined, options),
      toBeNaN: (options?: UntilToMatchOptions) => toMatch(v => !Number.isNaN(v as any), options),
    },
  }
}
