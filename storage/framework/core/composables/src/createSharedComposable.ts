/**
 * Make a composable function usable with multiple consumers.
 * The composable is only invoked once, and the result is shared.
 *
 * @param composable - The composable function to share
 * @returns A shared version of the composable
 */
export function createSharedComposable<Fn extends (...args: any[]) => any>(composable: Fn): Fn {
  let subscribers = 0
  let state: ReturnType<Fn> | undefined

  return ((...args: any[]) => {
    subscribers++
    if (!state)
      state = composable(...args)
    return state
  }) as Fn
}
