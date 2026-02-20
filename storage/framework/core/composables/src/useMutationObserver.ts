import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'
import { type MaybeRef, unref, noop } from './_shared'

export interface UseMutationObserverReturn {
  isSupported: Ref<boolean>
  stop: () => void
}

/**
 * Reactive MutationObserver.
 * Observes the target element and calls the callback when mutations occur.
 *
 * @param target - The element to observe (or a Ref to one)
 * @param callback - MutationCallback
 * @param options - MutationObserverInit options
 * @returns isSupported ref and stop function
 */
export function useMutationObserver(
  target: MaybeRef<HTMLElement | null>,
  callback: MutationCallback,
  options?: MutationObserverInit,
): UseMutationObserverReturn {
  const isSupported = ref(typeof window !== 'undefined' && 'MutationObserver' in window)
  let cleanup = noop

  const observe = (): void => {
    cleanup()

    if (!isSupported.value) return

    const el = unref(target)
    if (!el) return

    const observer = new MutationObserver(callback)
    observer.observe(el, options ?? { childList: true, subtree: true })

    cleanup = () => {
      observer.disconnect()
      cleanup = noop
    }
  }

  observe()

  const stop = (): void => {
    cleanup()
  }

  try {
    onUnmounted(stop)
  }
  catch {
    // Not in a component context
  }

  return { isSupported, stop }
}
