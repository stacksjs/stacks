import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'

/**
 * Reactively track whether the window is focused.
 */
export function useWindowFocus(): Ref<boolean> {
  const focused = ref(typeof document !== 'undefined' ? document.hasFocus() : false)

  if (typeof window === 'undefined')
    return focused

  const onFocus = (): void => { focused.value = true }
  const onBlur = (): void => { focused.value = false }

  window.addEventListener('focus', onFocus, { passive: true })
  window.addEventListener('blur', onBlur, { passive: true })

  try {
    onUnmounted(() => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('blur', onBlur)
    })
  }
  catch {
    // Not in a component context
  }

  return focused
}
