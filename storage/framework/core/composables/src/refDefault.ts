import type { Ref } from '@stacksjs/stx'
import { ref, watch } from '@stacksjs/stx'

/**
 * Apply a default value to a ref when it becomes null or undefined.
 *
 * @param source - The source ref
 * @param defaultValue - The default value to use when source is null/undefined
 * @returns A ref that always has a defined value
 */
export function refDefault<T>(source: Ref<T | null | undefined>, defaultValue: T): Ref<T> {
  const result = ref<T>(source.value ?? defaultValue) as Ref<T>

  watch(source, (val) => {
    result.value = val ?? defaultValue
  })

  return result
}
