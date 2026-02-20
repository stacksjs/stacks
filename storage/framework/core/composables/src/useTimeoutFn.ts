import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'

interface UseTimeoutFnReturn {
  start: () => void
  stop: () => void
  isPending: Ref<boolean>
}

/**
 * Call a function after a timeout.
 * Provides start/stop controls and auto-cleanup on unmount.
 *
 * @param cb - The callback to invoke after the timeout
 * @param interval - Timeout duration in milliseconds (default 1000)
 * @param options - Configuration options (immediate defaults to true)
 * @returns Controls to start, stop, and check pending state
 */
export function useTimeoutFn(
  cb: () => void,
  interval: number = 1000,
  options: { immediate?: boolean } = {},
): UseTimeoutFnReturn {
  const { immediate = true } = options
  const isPending = ref(false)
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  function stop(): void {
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    isPending.value = false
  }

  function start(): void {
    stop()
    isPending.value = true
    timeoutId = setTimeout(() => {
      timeoutId = null
      isPending.value = false
      cb()
    }, interval)
  }

  if (immediate) {
    start()
  }

  try {
    onUnmounted(stop)
  }
  catch {
    // Not in a component context
  }

  return { start, stop, isPending }
}
