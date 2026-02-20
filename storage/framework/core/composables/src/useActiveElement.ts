import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'

/**
 * Reactive `document.activeElement`.
 * Tracks which element currently has focus.
 */
export function useActiveElement(): Ref<Element | null> {
  const activeElement = ref<Element | null>(null) as Ref<Element | null>

  if (typeof document === 'undefined')
    return activeElement

  activeElement.value = document.activeElement

  const handler = (): void => {
    activeElement.value = document.activeElement
  }

  document.addEventListener('focusin', handler, { passive: true })
  document.addEventListener('focusout', handler, { passive: true })

  try {
    onUnmounted(() => {
      document.removeEventListener('focusin', handler)
      document.removeEventListener('focusout', handler)
    })
  }
  catch {
    // Not in a component context
  }

  return activeElement
}
