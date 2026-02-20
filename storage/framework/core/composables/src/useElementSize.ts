import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'
import { type MaybeRef, unref, noop } from './_shared'

export interface UseElementSizeOptions {
  initialSize?: { width: number, height: number }
}

export interface UseElementSizeReturn {
  width: Ref<number>
  height: Ref<number>
  stop: () => void
}

/**
 * Reactive element dimensions.
 * Uses ResizeObserver to track the width and height of an element.
 *
 * @param target - The element to observe (or a Ref to one)
 * @param options - Configuration with optional initial size
 * @returns Reactive width, height, and a stop function
 */
export function useElementSize(
  target: MaybeRef<HTMLElement | null>,
  options?: UseElementSizeOptions,
): UseElementSizeReturn {
  const width = ref(options?.initialSize?.width ?? 0)
  const height = ref(options?.initialSize?.height ?? 0)

  const isSupported = typeof window !== 'undefined' && 'ResizeObserver' in window
  let cleanup = noop

  if (isSupported) {
    const el = unref(target)

    if (el) {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentBoxSize) {
            const boxSize = Array.isArray(entry.contentBoxSize)
              ? entry.contentBoxSize[0]
              : entry.contentBoxSize
            width.value = boxSize.inlineSize
            height.value = boxSize.blockSize
          }
          else {
            width.value = entry.contentRect.width
            height.value = entry.contentRect.height
          }
        }
      })

      observer.observe(el)

      cleanup = () => {
        observer.disconnect()
        cleanup = noop
      }
    }
  }

  const stop = (): void => {
    cleanup()
  }

  try {
    onUnmounted(stop)
  }
  catch {
    // Not in a component context
  }

  return { width, height, stop }
}
