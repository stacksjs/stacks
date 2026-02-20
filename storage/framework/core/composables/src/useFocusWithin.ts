import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'
import type { MaybeRef } from './_shared'
import { unref } from './_shared'

/**
 * Reactive state of whether focus is contained within the target element.
 *
 * @param target - The target element or a ref to one
 * @returns focused - true when focus is within the element or its descendants
 */
export function useFocusWithin(target: MaybeRef<HTMLElement | null | undefined>): { focused: Ref<boolean> } {
  const focused = ref(false)

  let cleanup = (): void => {}

  function setup(el: HTMLElement | null | undefined): void {
    cleanup()
    if (!el) return

    const onFocusIn = (): void => { focused.value = true }
    const onFocusOut = (e: FocusEvent): void => {
      // Only set false if the new focus target is outside the element
      if (!el.contains(e.relatedTarget as Node))
        focused.value = false
    }

    el.addEventListener('focusin', onFocusIn, { passive: true })
    el.addEventListener('focusout', onFocusOut)

    cleanup = () => {
      el.removeEventListener('focusin', onFocusIn)
      el.removeEventListener('focusout', onFocusOut as EventListener)
      cleanup = () => {}
    }
  }

  setup(unref(target) as HTMLElement | null | undefined)

  try {
    onUnmounted(() => cleanup())
  }
  catch {
    // Not in a component context
  }

  return { focused }
}
