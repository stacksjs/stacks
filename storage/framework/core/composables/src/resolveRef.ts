import type { Ref } from '@stacksjs/stx'
import { ref } from '@stacksjs/stx'
import type { MaybeRef } from './_shared'
import { isRef } from './_shared'

/**
 * Normalize a value/ref/getter to a ref.
 * If already a ref, returns it as-is. Otherwise wraps in a new ref.
 */
export function resolveRef<T>(value: MaybeRef<T>): Ref<T> {
  if (isRef(value))
    return value as Ref<T>
  return ref(value) as Ref<T>
}
