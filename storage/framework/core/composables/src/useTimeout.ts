import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'

interface UseTimeoutControls {
  ready: Ref<boolean>
  start: () => void
  stop: () => void
}

interface UseTimeoutOptions {
  controls?: boolean
  immediate?: boolean
}

/**
 * Reactive timeout ready state.
 * Returns a ref that becomes true after the specified interval.
 *
 * @param interval - Timeout duration in milliseconds (default 1000)
 * @param options - Configuration options
 * @returns Ref<boolean> if controls is false, or UseTimeoutControls if controls is true
 */
export function useTimeout(interval?: number, options?: { controls: true, immediate?: boolean }): UseTimeoutControls
export function useTimeout(interval?: number, options?: { controls?: false, immediate?: boolean }): Ref<boolean>
export function useTimeout(interval: number = 1000, options: UseTimeoutOptions = {}): Ref<boolean> | UseTimeoutControls {
  const { controls = false, immediate = true } = options
  const ready = ref(false)
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  function stop(): void {
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    ready.value = false
  }

  function start(): void {
    stop()
    timeoutId = setTimeout(() => {
      ready.value = true
      timeoutId = null
    }, interval)
  }

  if (immediate) {
    start()
  }

  try {
    onUnmounted(() => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
    })
  }
  catch {
    // Not in a component context
  }

  if (controls) {
    return { ready, start, stop }
  }

  return ready
}
