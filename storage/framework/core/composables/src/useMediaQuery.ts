import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'
import type { MaybeRefOrGetter } from './_shared'
import { defaultWindow, toValue } from './_shared'

/**
 * Reactive media query matching.
 * Returns a ref that tracks whether the given CSS media query matches.
 *
 * @param query - CSS media query string (or ref/getter)
 */
export function useMediaQuery(query: MaybeRefOrGetter<string>): Ref<boolean> {
  const win = defaultWindow()
  const matches = ref(false)

  if (!win || !win.matchMedia) {
    return matches
  }

  const queryStr = toValue(query)
  const mediaQuery = win.matchMedia(queryStr)
  matches.value = mediaQuery.matches

  const handler = (e: MediaQueryListEvent): void => {
    matches.value = e.matches
  }

  mediaQuery.addEventListener('change', handler)

  try {
    onUnmounted(() => {
      mediaQuery.removeEventListener('change', handler)
    })
  }
  catch {
    // Not in a component context
  }

  return matches
}
