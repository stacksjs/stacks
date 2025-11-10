/**
 * Debounce and throttle utilities (perfect-debounce replacement)
 */

export interface DebounceOptions {
  /**
   * Call function on the leading edge instead of trailing
   * @default false
   */
  leading?: boolean

  /**
   * Call function on the trailing edge
   * @default true
   */
  trailing?: boolean
}

/**
 * Creates a debounced function that delays invoking func until after wait milliseconds
 * have elapsed since the last time the debounced function was invoked.
 *
 * @param fn - The function to debounce
 * @param wait - The number of milliseconds to delay
 * @param options - Options object
 * @returns The debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  wait: number = 0,
  options: DebounceOptions = {},
): T & { cancel: () => void; flush: () => void } {
  const { leading = false, trailing = true } = options

  let timeout: ReturnType<typeof setTimeout> | null = null
  let lastArgs: any[] | null = null
  let lastThis: any = null
  let result: any

  const invokeFunc = () => {
    if (lastArgs) {
      result = fn.apply(lastThis, lastArgs)
      lastArgs = null
      lastThis = null
    }
    return result
  }

  const cancel = () => {
    if (timeout) {
      clearTimeout(timeout)
      timeout = null
    }
    lastArgs = null
    lastThis = null
  }

  const flush = () => {
    if (timeout) {
      clearTimeout(timeout)
      timeout = null
      return invokeFunc()
    }
    return result
  }

  const debounced = function (this: any, ...args: any[]) {
    lastArgs = args
    lastThis = this

    const shouldCallNow = leading && !timeout

    if (timeout) {
      clearTimeout(timeout)
    }

    timeout = setTimeout(() => {
      timeout = null
      if (trailing && lastArgs) {
        invokeFunc()
      }
    }, wait)

    if (shouldCallNow) {
      return invokeFunc()
    }

    return result
  } as T & { cancel: () => void; flush: () => void }

  debounced.cancel = cancel
  debounced.flush = flush

  return debounced
}

/**
 * Creates a throttled function that only invokes func at most once per every wait milliseconds
 *
 * @param fn - The function to throttle
 * @param wait - The number of milliseconds to throttle
 * @returns The throttled function
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  wait: number = 0,
): T & { cancel: () => void } {
  let timeout: ReturnType<typeof setTimeout> | null = null
  let lastRun = 0
  let lastArgs: any[] | null = null
  let lastThis: any = null

  const invokeFunc = () => {
    if (lastArgs) {
      fn.apply(lastThis, lastArgs)
      lastArgs = null
      lastThis = null
      lastRun = Date.now()
    }
  }

  const cancel = () => {
    if (timeout) {
      clearTimeout(timeout)
      timeout = null
    }
    lastArgs = null
    lastThis = null
  }

  const throttled = function (this: any, ...args: any[]) {
    lastArgs = args
    lastThis = this

    const now = Date.now()
    const timeSinceLastRun = now - lastRun

    if (timeSinceLastRun >= wait) {
      invokeFunc()
    }
    else if (!timeout) {
      timeout = setTimeout(() => {
        timeout = null
        invokeFunc()
      }, wait - timeSinceLastRun)
    }
  } as T & { cancel: () => void }

  throttled.cancel = cancel

  return throttled
}

/**
 * Delays execution of a function
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
