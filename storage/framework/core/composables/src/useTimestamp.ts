import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'

interface UseTimestampOptions {
  offset?: number
  interval?: number | 'requestAnimationFrame'
  immediate?: boolean
}

/**
 * Reactive current timestamp.
 * Returns a ref containing Date.now() + offset, updated on a regular interval
 * or via requestAnimationFrame.
 *
 * @param options - Configuration options
 * @returns Ref<number> with the current timestamp
 */
export function useTimestamp(options: UseTimestampOptions = {}): Ref<number> {
  const { offset = 0, interval = 1000, immediate = true } = options
  const timestamp = ref(Date.now() + offset)

  let intervalId: ReturnType<typeof setInterval> | null = null
  let rafId: number | null = null
  let active = false

  function update(): void {
    timestamp.value = Date.now() + offset
  }

  function cleanup(): void {
    if (intervalId !== null) {
      clearInterval(intervalId)
      intervalId = null
    }
    if (rafId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    active = false
  }

  function start(): void {
    if (active) return
    active = true
    update()

    if (interval === 'requestAnimationFrame') {
      if (typeof requestAnimationFrame !== 'undefined') {
        const tick = (): void => {
          if (!active) return
          update()
          rafId = requestAnimationFrame(tick)
        }
        rafId = requestAnimationFrame(tick)
      }
    }
    else {
      intervalId = setInterval(update, interval)
    }
  }

  if (immediate) {
    start()
  }

  try {
    onUnmounted(cleanup)
  }
  catch {
    // Not in a component context
  }

  return timestamp
}
