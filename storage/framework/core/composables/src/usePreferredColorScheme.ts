import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'

export type ColorSchemeType = 'dark' | 'light' | 'no-preference'

/**
 * Reactive preferred color scheme.
 */
export function usePreferredColorScheme(): Ref<ColorSchemeType> {
  const scheme = ref<ColorSchemeType>('no-preference') as Ref<ColorSchemeType>

  if (typeof window === 'undefined' || !window.matchMedia)
    return scheme

  const dark = window.matchMedia('(prefers-color-scheme: dark)')
  const light = window.matchMedia('(prefers-color-scheme: light)')

  function update(): void {
    if (dark.matches) scheme.value = 'dark'
    else if (light.matches) scheme.value = 'light'
    else scheme.value = 'no-preference'
  }

  update()

  dark.addEventListener('change', update)
  light.addEventListener('change', update)

  try {
    onUnmounted(() => {
      dark.removeEventListener('change', update)
      light.removeEventListener('change', update)
    })
  }
  catch {
    // Not in a component context
  }

  return scheme
}
