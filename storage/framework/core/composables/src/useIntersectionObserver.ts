import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'
import { type MaybeRef, unref, noop } from './_shared'

export interface UseIntersectionObserverReturn {
  isSupported: Ref<boolean>
  stop: () => void
}

/**
 * Reactive IntersectionObserver.
 * Observes the target element and calls the callback when intersection changes.
 *
 * @param target - The element to observe (or a Ref to one)
 * @param callback - IntersectionObserverCallback
 * @param options - IntersectionObserverInit options
 * @returns isSupported ref and stop function
 */
export function useIntersectionObserver(
  target: MaybeRef<HTMLElement | null>,
  callback: IntersectionObserverCallback,
  options?: IntersectionObserverInit,
): UseIntersectionObserverReturn {
  const isSupported = ref(typeof window !== 'undefined' && 'IntersectionObserver' in window)
  let cleanup = noop

  const observe = (): void => {
    cleanup()

    if (!isSupported.value) return

    const el = unref(target)
    if (!el) return

    const observer = new IntersectionObserver(callback, options)
    observer.observe(el)

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
