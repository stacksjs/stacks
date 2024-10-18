export type NonNegativeInteger<T extends number> = number extends T
  ? never
  : `${T}` extends `-${string}` | `${string}.${string}`
    ? never
    : T

/**
 * Pauses execution for a specified number of milliseconds.
 * @param ms The number of milliseconds to pause execution.
 * @returns A promise that resolves after the specified delay.
 */
export function sleep(ms: number): Promise<void> {
  if (ms < 0 || !Number.isInteger(ms)) {
    throw new Error('sleep() requires a non-negative integer')
  }

  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Pauses execution for a specified number of milliseconds.
 * @param ms The number of milliseconds to pause execution.
 * @returns A promise that resolves after the specified delay.
 */
export function wait(ms: number): Promise<void> {
  if (ms < 0 || !Number.isInteger(ms)) {
    throw new Error('wait() requires a non-negative integer')
  }

  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Pauses execution for a specified number of milliseconds.
 * @param ms The number of milliseconds to pause execution.
 * @returns A promise that resolves after the specified delay.
 */
export function delay(ms: number): Promise<void> {
  if (ms < 0 || !Number.isInteger(ms)) {
    throw new Error('delay() requires a non-negative integer')
  }

  return new Promise(resolve => setTimeout(resolve, ms))
}

export type WaitOptions = number | {
  interval?: number
  timeout?: number
}

/**
 * Pauses execution until a specified condition is met.
 */
export function waitUntil(condition: () => boolean, options: WaitOptions = {}): Promise<void> {
  return new Promise((resolve) => {
    const { interval, timeout } = normalizeOptions(options)

    // Immediately resolve if the condition is initially true
    if (condition()) {
      resolve()
      return
    }

    const check = () => {
      if (condition()) {
        resolve()
      }
      else {
        setTimeout(check, interval)
      }
    }

    if (timeout) {
      setTimeout(resolve, timeout)
    }

    check()
  })
}

function normalizeOptions(options: WaitOptions): { interval: number, timeout: number } {
  if (typeof options === 'number') {
    return { interval: 100, timeout: options }
  }
  return {
    interval: options.interval ?? 100,
    timeout: options.timeout ?? 0,
  }
}

/**
 * Pauses execution while a specified condition is met.
 */
export function waitWhile(condition: () => boolean, options: WaitOptions = {}): Promise<void> {
  return new Promise((resolve) => {
    const { interval = 100, timeout = 0 } = options

    // Immediately resolve if the condition is initially false
    if (!condition()) {
      resolve()
      return
    }

    const check = () => {
      if (!condition()) {
        resolve()
      }
      else {
        setTimeout(check, interval)
      }
    }

    if (timeout) {
      setTimeout(resolve, timeout)
    }

    check()
  })
}
