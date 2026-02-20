import type { Ref } from '@stacksjs/stx'
import { ref, watch } from '@stacksjs/stx'
import type { MaybeRefOrGetter } from './_shared'
import { isRef, toValue } from './_shared'

/**
 * Reactively convert a value to a string.
 */
export function useToString(
  value: MaybeRefOrGetter<any>,
): Ref<string> {
  const result = ref<string>(String(toValue(value) ?? ''))

  if (isRef(value)) {
    watch(value as Ref<any>, (newVal) => {
      result.value = String(newVal ?? '')
    })
  }

  return result
}
