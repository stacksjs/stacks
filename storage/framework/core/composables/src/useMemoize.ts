/**
 * Memoize a function based on its arguments.
 *
 * @param fn - The function to memoize
 * @param getKey - Optional function to generate cache key from arguments
 * @returns A memoized version of the function with cache control methods
 */
export function useMemoize<T, Args extends any[]>(
  _fn: (..._args: Args) => T,
  getKey?: (...args: Args) => string,
): ((...args: Args) => T) & {
  load: (...args: Args) => T
  delete: (...args: Args) => void
  clear: () => void
  cache: Map<string, T>
} {
  const cache = new Map<string, T>()

  const keyFn = getKey ?? ((...args: Args) => JSON.stringify(args))

  const memoized = function (...args: Args): T {
    const key = keyFn(...args)
    if (cache.has(key))
      return cache.get(key)!
    const result = _fn(...args)
    cache.set(key, result)
    return result
  } as ((...args: Args) => T) & {
    load: (...args: Args) => T
    delete: (...args: Args) => void
    clear: () => void
    cache: Map<string, T>
  }

  memoized.load = (...args: Args): T => {
    const key = keyFn(...args)
    const result = _fn(...args)
    cache.set(key, result)
    return result
  }

  memoized.delete = (...args: Args): void => {
    const key = keyFn(...args)
    cache.delete(key)
  }

  memoized.clear = (): void => {
    cache.clear()
  }

  memoized.cache = cache

  return memoized
}
