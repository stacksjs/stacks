import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref, watch } from '@stacksjs/stx'
import type { MaybeRef } from './_shared'
import { unref } from './_shared'

export interface UseInfiniteScrollOptions {
  /** Distance in pixels from the bottom to trigger. Default: 100 */
  distance?: number
  /** Direction to detect. Default: 'bottom' */
  direction?: 'top' | 'bottom' | 'left' | 'right'
}

/**
 * Infinite scroll detection.
 * Calls the `onLoadMore` callback when the user scrolls near the edge.
 */
export function useInfiniteScroll(
  target: MaybeRef<HTMLElement | Window | null | undefined>,
  onLoadMore: () => void | Promise<void>,
  options: UseInfiniteScrollOptions = {},
): { isLoading: Ref<boolean> } {
  const { distance = 100, direction = 'bottom' } = options
  const isLoading = ref(false)
  let active = true

  const handler = async (): Promise<void> => {
    if (!active || isLoading.value) return

    const el = unref(target) as HTMLElement | Window | null
    if (!el) return

    let shouldLoad = false

    if (el === window || el === document.documentElement) {
      const scrollTop = window.scrollY || document.documentElement.scrollTop
      const scrollHeight = document.documentElement.scrollHeight
      const clientHeight = window.innerHeight

      if (direction === 'bottom')
        shouldLoad = scrollHeight - scrollTop - clientHeight <= distance
      else if (direction === 'top')
        shouldLoad = scrollTop <= distance
    }
    else {
      const element = el as HTMLElement
      if (direction === 'bottom')
        shouldLoad = element.scrollHeight - element.scrollTop - element.clientHeight <= distance
      else if (direction === 'top')
        shouldLoad = element.scrollTop <= distance
      else if (direction === 'right')
        shouldLoad = element.scrollWidth - element.scrollLeft - element.clientWidth <= distance
      else if (direction === 'left')
        shouldLoad = element.scrollLeft <= distance
    }

    if (shouldLoad) {
      isLoading.value = true
      try {
        await onLoadMore()
      }
      finally {
        isLoading.value = false
      }
    }
  }

  const el = unref(target) as HTMLElement | Window | null
  if (el) {
    const scrollTarget = el === document.documentElement ? window : el
    scrollTarget.addEventListener('scroll', handler, { passive: true })

    try {
      onUnmounted(() => {
        active = false
        scrollTarget.removeEventListener('scroll', handler)
      })
    }
    catch {
      // Not in a component context
    }
  }

  return { isLoading }
}
