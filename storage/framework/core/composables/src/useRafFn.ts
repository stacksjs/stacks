import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'

interface UseRafFnCallbackArgs {
  delta: number
  timestamp: number
}

interface UseRafFnReturn {
  pause: () => void
  resume: () => void
  isActive: Ref<boolean>
}

/**
 * Call a function on every requestAnimationFrame.
 * Provides pause/resume controls and auto-cleanup on unmount.
 *
 * @param fn - The callback invoked on each animation frame, receives { delta, timestamp }
 * @param options - Configuration options (immediate defaults to true)
 * @returns Controls to pause, resume, and check active state
 */
export function useRafFn(
  fn: (args: UseRafFnCallbackArgs) => void,
  options: { immediate?: boolean } = {},
): UseRafFnReturn {
  const { immediate = true } = options
  const isActive = ref(false)
  let rafId: number | null = null
  let previousTimestamp = 0

  function loop(timestamp: number): void {
    if (!isActive.value) return
    const delta = previousTimestamp ? timestamp - previousTimestamp : 0
    previousTimestamp = timestamp
    fn({ delta, timestamp })
    rafId = requestAnimationFrame(loop)
  }

  function resume(): void {
    if (isActive.value) return
    if (typeof requestAnimationFrame === 'undefined') return
    isActive.value = true
    previousTimestamp = 0
    rafId = requestAnimationFrame(loop)
  }

  function pause(): void {
    if (!isActive.value) return
    isActive.value = false
    if (rafId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }

  if (immediate) {
    resume()
  }

  try {
    onUnmounted(pause)
  }
  catch {
    // Not in a component context
  }

  return { pause, resume, isActive }
}
