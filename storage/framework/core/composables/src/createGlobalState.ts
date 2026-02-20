/**
 * Keep state in the global scope to be reusable across components.
 *
 * @param stateFactory - A function that creates the state
 * @returns A function that returns the shared state
 *
 * @example
 * ```ts
 * const useGlobalCount = createGlobalState(() => {
 *   const count = ref(0)
 *   return { count }
 * })
 * // In any component:
 * const { count } = useGlobalCount()
 * ```
 */
export function createGlobalState<T>(stateFactory: () => T): () => T {
  let initialized = false
  let state: T

  return (): T => {
    if (!initialized) {
      state = stateFactory()
      initialized = true
    }
    return state
  }
}
