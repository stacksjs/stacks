import type { Ref } from '@stacksjs/stx'
import { ref, watch } from '@stacksjs/stx'

/**
 * Create a ref that automatically resets to a default value after a delay.
 *
 * @param defaultValue - The default value to reset to
 * @param afterMs - Delay in milliseconds before resetting (default 1000)
 * @returns A ref that auto-resets
 */
export function refAutoReset<T>(defaultValue: T, afterMs: number = 1000): Ref<T> {
  const value = ref<T>(defaultValue) as Ref<T>
  let timer: ReturnType<typeof setTimeout> | null = null

  watch(value, () => {
    if (timer !== null)
      clearTimeout(timer)
    timer = setTimeout(() => {
      value.value = defaultValue
      timer = null
    }, afterMs)
  })

  return value
}

/** Alias for refAutoReset */
export const autoResetRef = refAutoReset
