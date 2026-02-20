import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'

export type ContrastType = 'more' | 'less' | 'custom' | 'no-preference'

/**
 * Reactive preferred contrast.
 */
export function usePreferredContrast(): Ref<ContrastType> {
  const contrast = ref<ContrastType>('no-preference') as Ref<ContrastType>

  if (typeof window === 'undefined' || !window.matchMedia)
    return contrast

  const more = window.matchMedia('(prefers-contrast: more)')
  const less = window.matchMedia('(prefers-contrast: less)')
  const custom = window.matchMedia('(prefers-contrast: custom)')

  function update(): void {
    if (more.matches) contrast.value = 'more'
    else if (less.matches) contrast.value = 'less'
    else if (custom.matches) contrast.value = 'custom'
    else contrast.value = 'no-preference'
  }

  update()

  more.addEventListener('change', update)
  less.addEventListener('change', update)
  custom.addEventListener('change', update)

  try {
    onUnmounted(() => {
      more.removeEventListener('change', update)
      less.removeEventListener('change', update)
      custom.removeEventListener('change', update)
    })
  }
  catch {
    // Not in a component context
  }

  return contrast
}
