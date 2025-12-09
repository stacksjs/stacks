/**
 * useMediaQuery Composable
 * Reactive media query matching.
 */
import { ref, onMounted, onUnmounted, readonly } from 'vue'

export interface UseMediaQueryReturn {
  /**
   * Whether the media query matches.
   */
  matches: ReturnType<typeof readonly<ReturnType<typeof ref<boolean>>>>
}

/**
 * Track a CSS media query reactively.
 *
 * @example
 * ```ts
 * const { matches: isMobile } = useMediaQuery('(max-width: 768px)')
 * const { matches: prefersDark } = useMediaQuery('(prefers-color-scheme: dark)')
 * const { matches: prefersReducedMotion } = useMediaQuery('(prefers-reduced-motion: reduce)')
 * ```
 */
export function useMediaQuery(query: string): UseMediaQueryReturn {
  const matches = ref(false)
  let mediaQuery: MediaQueryList | null = null

  function update() {
    if (mediaQuery) {
      matches.value = mediaQuery.matches
    }
  }

  onMounted(() => {
    if (typeof window !== 'undefined') {
      mediaQuery = window.matchMedia(query)
      matches.value = mediaQuery.matches
      mediaQuery.addEventListener('change', update)
    }
  })

  onUnmounted(() => {
    if (mediaQuery) {
      mediaQuery.removeEventListener('change', update)
    }
  })

  return {
    matches: readonly(matches),
  }
}

// Preset media queries
export function useIsMobile() {
  return useMediaQuery('(max-width: 767px)')
}

export function useIsTablet() {
  return useMediaQuery('(min-width: 768px) and (max-width: 1023px)')
}

export function useIsDesktop() {
  return useMediaQuery('(min-width: 1024px)')
}

export function usePrefersReducedMotion() {
  return useMediaQuery('(prefers-reduced-motion: reduce)')
}

export function usePrefersDark() {
  return useMediaQuery('(prefers-color-scheme: dark)')
}
