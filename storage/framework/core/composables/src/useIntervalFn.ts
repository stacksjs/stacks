import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'

interface UseIntervalFnReturn {
  pause: () => void
  resume: () => void
  isActive: Ref<boolean>
}

/**
 * Call a function on a regular interval.
 * Provides pause/resume controls and auto-cleanup on unmount.
 *
 * @param cb - The callback to invoke on each interval tick
 * @param interval - Interval duration in milliseconds (default 1000)
 * @param options - Configuration options
 * @returns Controls to pause, resume, and check active state
 */
export function useIntervalFn(
  cb: () => void,
  interval: number = 1000,
  options: { immediate?: boolean } = {},
): UseIntervalFnReturn {
  const { immediate = true } = options
  const isActive = ref(false)
  let intervalId: ReturnType<typeof setInterval> | null = null

  function pause(): void {
    if (intervalId !== null) {
      clearInterval(intervalId)
      intervalId = null
    }
    isActive.value = false
  }

  function resume(): void {
    if (intervalId !== null) return
    isActive.value = true
    intervalId = setInterval(cb, interval)
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
