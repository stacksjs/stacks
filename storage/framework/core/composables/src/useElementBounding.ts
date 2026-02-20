import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'
import { type MaybeRef, unref, noop } from './_shared'

export interface UseElementBoundingReturn {
  x: Ref<number>
  y: Ref<number>
  top: Ref<number>
  right: Ref<number>
  bottom: Ref<number>
  left: Ref<number>
  width: Ref<number>
  height: Ref<number>
  update: () => void
}

/**
 * Reactive element bounding rect.
 * Tracks the element's position and size, updating on resize, scroll, and mutations.
 *
 * @param target - The element to observe (or a Ref to one)
 * @returns Reactive bounding rect properties and update function
 */
export function useElementBounding(
  target: MaybeRef<HTMLElement | null>,
): UseElementBoundingReturn {
  const x = ref(0)
  const y = ref(0)
  const top = ref(0)
  const right = ref(0)
  const bottom = ref(0)
  const left = ref(0)
  const width = ref(0)
  const height = ref(0)

  const cleanups: Array<() => void> = []
  let cleanup = noop

  const update = (): void => {
    const el = unref(target)
    if (!el) return

    const rect = el.getBoundingClientRect()
    x.value = rect.x
    y.value = rect.y
    top.value = rect.top
    right.value = rect.right
    bottom.value = rect.bottom
    left.value = rect.left
    width.value = rect.width
    height.value = rect.height
  }

  if (typeof window !== 'undefined') {
    // Initial update
    update()

    // Listen for resize events
    const onResize = (): void => update()
    window.addEventListener('resize', onResize, { passive: true })
    cleanups.push(() => window.removeEventListener('resize', onResize))

    // Listen for scroll events
    const onScroll = (): void => update()
    window.addEventListener('scroll', onScroll, { passive: true })
    cleanups.push(() => window.removeEventListener('scroll', onScroll))

    // Use ResizeObserver if available
    if ('ResizeObserver' in window) {
      const el = unref(target)
      if (el) {
        const resizeObserver = new ResizeObserver(update)
        resizeObserver.observe(el)
        cleanups.push(() => resizeObserver.disconnect())
      }
    }

    // Use MutationObserver if available
    if ('MutationObserver' in window) {
      const el = unref(target)
      if (el) {
        const mutationObserver = new MutationObserver(update)
        mutationObserver.observe(el, {
          childList: true,
          subtree: true,
          attributes: true,
        })
        cleanups.push(() => mutationObserver.disconnect())
      }
    }

    cleanup = () => {
      for (const fn of cleanups) fn()
      cleanups.length = 0
      cleanup = noop
    }
  }

  try {
    onUnmounted(() => cleanup())
  }
  catch {
    // Not in a component context
  }

  return { x, y, top, right, bottom, left, width, height, update }
}
