import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'

/**
 * Reactively track `document.visibilityState`.
 */
export function useDocumentVisibility(): Ref<DocumentVisibilityState> {
  const visibility = ref<DocumentVisibilityState>(
    typeof document !== 'undefined' ? document.visibilityState : 'visible',
  ) as Ref<DocumentVisibilityState>

  if (typeof document === 'undefined')
    return visibility

  const handler = (): void => {
    visibility.value = document.visibilityState
  }

  document.addEventListener('visibilitychange', handler, { passive: true })

  try {
    onUnmounted(() => {
      document.removeEventListener('visibilitychange', handler)
    })
  }
  catch {
    // Not in a component context
  }

  return visibility
}
