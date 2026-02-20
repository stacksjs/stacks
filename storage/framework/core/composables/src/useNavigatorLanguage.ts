import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'

/**
 * Reactive navigator language.
 */
export function useNavigatorLanguage(): { language: Ref<string>, isSupported: Ref<boolean> } {
  const isSupported = ref(typeof navigator !== 'undefined' && 'language' in navigator)
  const language = ref(isSupported.value ? navigator.language : '')

  if (typeof window !== 'undefined') {
    const handler = (): void => {
      if (isSupported.value)
        language.value = navigator.language
    }

    window.addEventListener('languagechange', handler, { passive: true })

    try {
      onUnmounted(() => {
        window.removeEventListener('languagechange', handler)
      })
    }
    catch {
      // Not in a component context
    }
  }

  return { language, isSupported }
}
