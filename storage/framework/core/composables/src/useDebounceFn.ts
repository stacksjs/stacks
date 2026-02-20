/**
 * Debounce a function.
 * Delays invoking the function until after `ms` milliseconds have elapsed
 * since the last time the debounced function was invoked.
 *
 * @param fn - The function to debounce
 * @param ms - Delay in milliseconds (default 200)
 * @returns The debounced function with a `cancel` method
 */
export function useDebounceFn<T extends (...args: any[]) => any>(
  fn: T,
  ms: number = 200,
): T & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  const debounced = function (this: any, ...args: Parameters<T>): void {
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => {
      timeoutId = null
      fn.apply(this, args)
    }, ms)
  } as unknown as T & { cancel: () => void }

  debounced.cancel = (): void => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
  }

  return debounced
}
