import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'

/**
 * Reactive `navigator.languages`. Returns the user's preferred languages.
 */
export function usePreferredLanguages(): Ref<readonly string[]> {
  const languages = ref<readonly string[]>(
    typeof navigator !== 'undefined' ? navigator.languages : [],
  ) as Ref<readonly string[]>

  if (typeof window === 'undefined')
    return languages

  const handler = (): void => {
    languages.value = navigator.languages
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

  return languages
}
