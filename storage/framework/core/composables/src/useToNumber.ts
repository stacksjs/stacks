import type { Ref } from '@stacksjs/stx'
import { computed, ref, watch } from '@stacksjs/stx'
import type { MaybeRefOrGetter } from './_shared'
import { toValue } from './_shared'

export interface UseToNumberOptions {
  /**
   * Method to convert the value to a number.
   * @default 'parseFloat'
   */
  method?: 'parseFloat' | 'parseInt'
  /**
   * The radix for parseInt.
   * @default 10
   */
  radix?: number
  /**
   * Replace NaN with this value.
   * @default 0
   */
  nanToZero?: boolean
}

/**
 * Reactively convert a string ref to a number.
 */
export function useToNumber(
  value: MaybeRefOrGetter<string | number>,
  options: UseToNumberOptions = {},
): Ref<number> {
  const { method = 'parseFloat', radix = 10, nanToZero = false } = options

  const result = ref<number>(0)

  function convert(val: string | number): number {
    if (typeof val === 'number')
      return val
    let num: number
    if (method === 'parseInt')
      num = Number.parseInt(val, radix)
    else
      num = Number.parseFloat(val)
    if (nanToZero && Number.isNaN(num))
      return 0
    return num
  }

  result.value = convert(toValue(value))

  if (typeof value === 'function') {
    // getter - we can't watch it without deps, just evaluate once
  }
  else if (value && typeof value === 'object' && 'value' in value && 'subscribe' in value) {
    watch(value as Ref<any>, (newVal) => {
      result.value = convert(newVal)
    })
  }

  return result
}
