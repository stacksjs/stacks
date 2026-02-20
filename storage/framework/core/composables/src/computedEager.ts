import type { Ref } from '@stacksjs/stx'
import { ref, watch } from '@stacksjs/stx'

/**
 * Create an eagerly evaluated computed ref.
 *
 * Unlike the standard lazy `computed()`, this evaluates the function immediately
 * whenever any watched dependency changes, rather than deferring evaluation
 * until `.value` is accessed. This is useful when you want to precompute values
 * eagerly.
 *
 * Since stx does not auto-track dependencies in the same way as Vue's computed,
 * this accepts an optional array of dependency refs to watch. When any dependency
 * changes, the function is re-evaluated immediately.
 *
 * @param fn - A synchronous function that returns the computed value
 * @param deps - Optional array of reactive refs to watch for re-evaluation
 * @returns A ref containing the eagerly computed value
 *
 * @example
 * ```ts
 * const list = ref([1, 2, 3, 4, 5])
 * const sum = computedEager(() => list.value.reduce((a, b) => a + b, 0), [list])
 * console.log(sum.value) // 15
 * list.value = [10, 20]
 * console.log(sum.value) // 30
 * ```
 */
export function computedEager<T>(fn: () => T, deps?: Ref<any>[]): Ref<T> {
  const result = ref(fn()) as Ref<T>

  if (deps && deps.length > 0) {
    for (const dep of deps) {
      watch(dep, () => {
        result.value = fn()
      })
    }
  }

  return result
}
