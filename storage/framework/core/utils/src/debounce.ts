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

type Callback = (...args: any[]) => any
type ControlledCall<T extends Callback> = (this: ThisParameterType<T>, ...args: Parameters<T>) => ReturnType<T> | undefined
export type DebouncedFunction<T extends Callback> = ControlledCall<T> & { cancel: () => void, flush: () => ReturnType<T> | undefined }
export type ThrottledFunction<T extends Callback> = ControlledCall<T> & { cancel: () => void }

/**
 * Creates a debounced function that delays invoking func until after wait milliseconds
 * have elapsed since the last time the debounced function was invoked.
 *
 * @param fn - The function to debounce
 * @param wait - The number of milliseconds to delay
 * @param options - Options object
 * @returns The debounced function
 */
export function debounce<T extends Callback>(
  fn: T,
  wait: number = 0,
  options: DebounceOptions = {},
): DebouncedFunction<T> {
  const { leading = false, trailing = true } = options

  let timeout: ReturnType<typeof setTimeout> | null = null
  let lastArgs: any[] | null = null
  let lastThis: any = null
  let result: ReturnType<T> | undefined

  const invokeFunc = () => {
    if (lastArgs) {
      const args = lastArgs, receiver = lastThis
      lastArgs = null
      lastThis = null
      result = fn.apply(receiver, args)
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

  const debounced = function (this: ThisParameterType<T>, ...args: Parameters<T>) {
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
      else { lastArgs = null; lastThis = null }
    }, wait)

    if (shouldCallNow) {
      return invokeFunc()
    }

    // Returns the result from the previous invocation (standard debounce behavior)
    return result
  } as DebouncedFunction<T>

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
export function throttle<T extends Callback>(
  fn: T,
  wait: number = 0,
): ThrottledFunction<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null
  let lastRun: number | undefined
  let lastArgs: any[] | null = null
  let lastThis: any = null
  let result: ReturnType<T> | undefined

  const invokeFunc = () => {
    if (lastArgs) {
      const args = lastArgs, receiver = lastThis
      lastArgs = null
      lastThis = null
      lastRun = Date.now()
      result = fn.apply(receiver, args)
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
    lastRun = undefined
  }

  const throttled = function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    lastArgs = args
    lastThis = this

    const now = Date.now()
    const timeSinceLastRun = lastRun === undefined ? Infinity : now - lastRun

    if (timeSinceLastRun >= wait || timeSinceLastRun < 0) {
      if (timeout) { clearTimeout(timeout); timeout = null }
      return invokeFunc()
    }
    else if (!timeout) {
      timeout = setTimeout(() => {
        timeout = null
        invokeFunc()
      }, wait - timeSinceLastRun)
    }
    return result
  } as ThrottledFunction<T>

  throttled.cancel = cancel

  return throttled
}

/**
 * Delays execution of a function
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
