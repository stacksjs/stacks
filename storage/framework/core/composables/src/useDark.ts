import type { Ref } from '@stacksjs/stx'
import { ref, watch } from '@stacksjs/stx'

/**
 * Reactive preferred color scheme detection.
 * Returns a ref that tracks the user's OS-level dark mode preference.
 */
export function usePreferredDark(): Ref<boolean> {
  const matches = ref(false)

  if (typeof window !== 'undefined' && window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    matches.value = mq.matches
    mq.addEventListener('change', (e) => {
      matches.value = e.matches
    })
  }

  return matches
}

/**
 * Reactive dark mode with localStorage persistence.
 * Adds/removes the 'dark' class on document.documentElement.
 */
export function useDark(): Ref<boolean> {
  const prefersDark = usePreferredDark()

  let initial = prefersDark.value
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem('color-scheme')
    if (stored === 'dark') initial = true
    else if (stored === 'light') initial = false
  }

  const isDark = ref(initial)

  watch(isDark, (val) => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', val)
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('color-scheme', val ? 'dark' : 'light')
    }
  })

  // Apply initial state
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', isDark.value)
  }

  return isDark
}
