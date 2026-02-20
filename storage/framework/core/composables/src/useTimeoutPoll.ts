import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'

export interface UseTimeoutPollReturn {
  isActive: Ref<boolean>
  pause: () => void
  resume: () => void
}

/**
 * Poll a function with setTimeout. Waits for the function to complete before scheduling the next.
 */
export function useTimeoutPoll(
  fn: () => Promise<void> | void,
  interval: number,
  options?: { immediate?: boolean },
): UseTimeoutPollReturn {
  const { immediate = true } = options ?? {}
  const isActive = ref(false)
  let timer: ReturnType<typeof setTimeout> | null = null

  async function poll(): Promise<void> {
    if (!isActive.value) return
    try {
      await fn()
    }
    catch {
      // Swallow errors to keep polling
    }
    if (isActive.value)
      timer = setTimeout(poll, interval)
  }

  function resume(): void {
    if (isActive.value) return
    isActive.value = true
    poll()
  }

  function pause(): void {
    isActive.value = false
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  if (immediate)
    resume()

  try {
    onUnmounted(() => pause())
  }
  catch {
    // Not in a component context
  }

  return { isActive, pause, resume }
}
