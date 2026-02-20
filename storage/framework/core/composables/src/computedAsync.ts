import type { Ref } from '@stacksjs/stx'
import { ref, watch } from '@stacksjs/stx'

/**
 * Create an async computed ref.
 *
 * Returns a ref whose value is the result of an asynchronous evaluation function.
 * Since stx does not auto-track dependencies like Vue's watchEffect, you can
 * provide an optional array of dependency refs. When any dependency changes,
 * the evaluation callback is re-run.
 *
 * @param evaluationCallback - An async function that returns the computed value
 * @param initialState - The initial value before the first evaluation completes
 * @param deps - Optional array of reactive refs to watch for re-evaluation
 * @returns A ref containing the async computed value
 *
 * @example
 * ```ts
 * const userId = ref(1)
 * const user = computedAsync(
 *   async () => {
 *     const response = await fetch(`/api/users/${userId.value}`)
 *     return response.json()
 *   },
 *   null,
 *   [userId],
 * )
 * ```
 */
export function computedAsync<T>(
  evaluationCallback: () => Promise<T>,
  initialState: T,
  deps?: Ref<any>[],
): Ref<T> {
  const result = ref(initialState) as Ref<T>
  let currentEvalId = 0

  async function evaluate(): Promise<void> {
    const evalId = ++currentEvalId
    try {
      const value = await evaluationCallback()
      // Only update if this is still the latest evaluation
      if (evalId === currentEvalId) {
        result.value = value
      }
    }
    catch {
      // Silently handle errors - the ref retains its previous value
    }
  }

  // Initial evaluation
  evaluate()

  // Watch deps for re-evaluation
  if (deps && deps.length > 0) {
    for (const dep of deps) {
      watch(dep, () => {
        evaluate()
      })
    }
  }

  return result
}
