import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'

interface UseIntervalControls {
  counter: Ref<number>
  pause: () => void
  resume: () => void
  reset: () => void
}

interface UseIntervalOptions {
  controls?: boolean
  immediate?: boolean
}

/**
 * Reactive interval counter.
 * Increments a counter ref on every interval tick.
 *
 * @param interval - Interval duration in milliseconds (default 1000)
 * @param options - Configuration options
 * @returns Ref<number> if controls is false, or UseIntervalControls if controls is true
 */
export function useInterval(interval?: number, options?: { controls: true, immediate?: boolean }): UseIntervalControls
export function useInterval(interval?: number, options?: { controls?: false, immediate?: boolean }): Ref<number>
export function useInterval(interval: number = 1000, options: UseIntervalOptions = {}): Ref<number> | UseIntervalControls {
  const { controls = false, immediate = true } = options
  const counter = ref<number>(0)
  let intervalId: ReturnType<typeof setInterval> | null = null

  function pause(): void {
    if (intervalId !== null) {
      clearInterval(intervalId)
      intervalId = null
    }
  }

  function resume(): void {
    if (intervalId !== null) return
    intervalId = setInterval(() => {
      counter.value++
    }, interval)
  }

  function reset(): void {
    counter.value = 0
    pause()
    if (immediate) {
      resume()
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

  if (controls) {
    return { counter, pause, resume, reset }
  }

  return counter
}
