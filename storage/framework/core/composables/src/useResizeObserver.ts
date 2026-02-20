import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'
import { type MaybeRef, unref, noop } from './_shared'

export interface UseResizeObserverReturn {
  isSupported: Ref<boolean>
  stop: () => void
}

/**
 * Reactive ResizeObserver.
 * Observes the target element and calls the callback when the element is resized.
 *
 * @param target - The element to observe (or a Ref to one)
 * @param callback - ResizeObserverCallback
 * @param options - ResizeObserverOptions
 * @returns isSupported ref and stop function
 */
export function useResizeObserver(
  target: MaybeRef<HTMLElement | null>,
  callback: ResizeObserverCallback,
  options?: ResizeObserverOptions,
): UseResizeObserverReturn {
  const isSupported = ref(typeof window !== 'undefined' && 'ResizeObserver' in window)
  let cleanup = noop

  const observe = (): void => {
    cleanup()

    if (!isSupported.value) return

    const el = unref(target)
    if (!el) return

    const observer = new ResizeObserver(callback)
    observer.observe(el, options)

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
