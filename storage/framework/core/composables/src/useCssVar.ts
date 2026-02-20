import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref, watch } from '@stacksjs/stx'
import type { MaybeRef } from './_shared'
import { unref } from './_shared'

/**
 * Reactive CSS variable binding.
 *
 * @param name - The CSS variable name (e.g., '--color')
 * @param target - The target element (defaults to document.documentElement)
 * @param defaultValue - Default value if the variable is not set
 */
export function useCssVar(
  name: MaybeRef<string>,
  target?: MaybeRef<HTMLElement | null | undefined>,
  defaultValue?: string,
): Ref<string> {
  const variable = ref(defaultValue ?? '')

  const getEl = (): HTMLElement | null => {
    const t = unref(target)
    if (t) return t as HTMLElement
    if (typeof document !== 'undefined') return document.documentElement
    return null
  }

  // Read initial value
  const el = getEl()
  if (el) {
    const current = getComputedStyle(el).getPropertyValue(unref(name)).trim()
    if (current)
      variable.value = current
  }

  // Watch for changes and update the CSS variable
  watch(variable, (val) => {
    const element = getEl()
    if (element)
      element.style.setProperty(unref(name), val)
  })

  return variable
}
