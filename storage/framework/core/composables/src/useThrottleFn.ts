/**
 * Throttle a function.
 * Ensures the function is called at most once every `ms` milliseconds.
 * Supports a trailing call: if the function is called during the throttle
 * period, the last call will be executed after the period ends.
 *
 * @param fn - The function to throttle
 * @param ms - Throttle interval in milliseconds (default 200)
 * @returns The throttled function with a `cancel` method
 */
export function useThrottleFn<T extends (...args: any[]) => any>(
  fn: T,
  ms: number = 200,
): T & { cancel: () => void } {
  let lastExec = 0
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let lastArgs: Parameters<T> | null = null
  let lastThis: any = null

  const throttled = function (this: any, ...args: Parameters<T>): void {
    const now = Date.now()
    const elapsed = now - lastExec

    if (elapsed >= ms) {
      // Enough time has passed, execute immediately
      lastExec = now
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      fn.apply(this, args)
    }
    else {
      // Store for trailing call
      lastArgs = args
      lastThis = this

      if (timeoutId === null) {
        timeoutId = setTimeout(() => {
          lastExec = Date.now()
          timeoutId = null
          if (lastArgs !== null) {
            fn.apply(lastThis, lastArgs)
            lastArgs = null
            lastThis = null
          }
        }, ms - elapsed)
      }
    }
  } as unknown as T & { cancel: () => void }

  throttled.cancel = (): void => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    lastArgs = null
    lastThis = null
  }

  return throttled
}
