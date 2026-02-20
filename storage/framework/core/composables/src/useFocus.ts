import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref, watch } from '@stacksjs/stx'
import type { MaybeRef } from './_shared'
import { unref } from './_shared'

export interface UseFocusOptions {
  /** Focus the element on creation. Default: false */
  initialValue?: boolean
}

export interface UseFocusReturn {
  /** Whether the element is focused */
  focused: Ref<boolean>
}

/**
 * Reactive element focus state.
 * Setting `focused.value = true` will focus the element, and vice versa.
 */
export function useFocus(target: MaybeRef<HTMLElement | null | undefined>, options: UseFocusOptions = {}): UseFocusReturn {
  const { initialValue = false } = options
  const focused = ref(initialValue)

  let cleanup = (): void => {}

  function setup(el: HTMLElement | null | undefined): void {
    cleanup()
    if (!el) return

    const onFocus = (): void => { focused.value = true }
    const onBlur = (): void => { focused.value = false }

    el.addEventListener('focus', onFocus, { passive: true })
    el.addEventListener('blur', onBlur, { passive: true })

    cleanup = () => {
      el.removeEventListener('focus', onFocus)
      el.removeEventListener('blur', onBlur)
      cleanup = () => {}
    }

    // Check if already focused
    if (document.activeElement === el)
      focused.value = true

    // Apply initial focus
    if (initialValue)
      el.focus()
  }

  const el = unref(target) as HTMLElement | null | undefined
  setup(el)

  // Watch focused to programmatically focus/blur
  watch(focused, (val) => {
    const element = unref(target) as HTMLElement | null | undefined
    if (!element) return
    if (val)
      element.focus()
    else
      element.blur()
  })

  try {
    onUnmounted(() => cleanup())
  }
  catch {
    // Not in a component context
  }

  return { focused }
}
