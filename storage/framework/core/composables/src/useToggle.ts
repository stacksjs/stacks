import type { Ref } from '@stacksjs/stx'
import { ref } from '@stacksjs/stx'

/**
 * Simple boolean toggle.
 * Returns [state, toggleFn] where toggleFn flips the boolean or sets a specific value.
 */
export function useToggle(initialValue: Ref<boolean> | boolean = false): [Ref<boolean>, (value?: boolean) => boolean] {
  const state = typeof initialValue === 'boolean' ? ref(initialValue) : initialValue

  function toggle(value?: boolean): boolean {
    if (typeof value === 'boolean') {
      state.value = value
    }
    else {
      state.value = !state.value
    }
    return state.value
  }

  return [state, toggle]
}
