import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'

export interface UseWindowScrollReturn {
  x: Ref<number>
  y: Ref<number>
}

/**
 * Reactive window scroll position.
 */
export function useWindowScroll(): UseWindowScrollReturn {
  const x = ref(typeof window !== 'undefined' ? window.scrollX : 0)
  const y = ref(typeof window !== 'undefined' ? window.scrollY : 0)

  if (typeof window === 'undefined')
    return { x, y }

  const handler = (): void => {
    x.value = window.scrollX
    y.value = window.scrollY
  }

  window.addEventListener('scroll', handler, { passive: true })

  try {
    onUnmounted(() => {
      window.removeEventListener('scroll', handler)
    })
  }
  catch {
    // Not in a component context
  }

  return { x, y }
}
