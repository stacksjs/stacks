import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'

/**
 * Reactively track the device pixel ratio.
 */
export function useDevicePixelRatio(): { pixelRatio: Ref<number> } {
  const pixelRatio = ref(typeof window !== 'undefined' ? window.devicePixelRatio : 1)

  if (typeof window === 'undefined')
    return { pixelRatio }

  let mq: MediaQueryList | null = null
  let cleanup = (): void => {}

  function observe(): void {
    cleanup()
    mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
    const handler = (): void => {
      pixelRatio.value = window.devicePixelRatio
      observe() // Re-observe with new ratio
    }
    mq.addEventListener('change', handler, { once: true })
    cleanup = () => {
      mq?.removeEventListener('change', handler)
    }
  }

  observe()

  try {
    onUnmounted(() => cleanup())
  }
  catch {
    // Not in a component context
  }

  return { pixelRatio }
}
