import type { Ref } from '@stacksjs/stx'

/**
 * Check if a ref value is defined (not null or undefined).
 */
export function isDefined<T>(v: Ref<T>): v is Ref<Exclude<T, null | undefined>> {
  return v.value !== null && v.value !== undefined
}
