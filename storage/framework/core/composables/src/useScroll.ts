import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'
import type { MaybeRef } from './_shared'
import { unref } from './_shared'

export interface UseScrollOptions {
  /**
   * Throttle time in milliseconds.
   * @default 0
   */
  throttle?: number
  /**
   * Offset for detecting arrival at edges (in px).
   * @default 0
   */
  offset?: {
    top?: number
    bottom?: number
    left?: number
    right?: number
  }
}

export interface UseScrollReturn {
  x: Ref<number>
  y: Ref<number>
  isScrolling: Ref<boolean>
  arrivedState: {
    top: Ref<boolean>
    bottom: Ref<boolean>
    left: Ref<boolean>
    right: Ref<boolean>
  }
  directions: {
    top: Ref<boolean>
    bottom: Ref<boolean>
    left: Ref<boolean>
    right: Ref<boolean>
  }
}

/**
 * Reactive scroll position tracking.
 * Tracks scroll position, scrolling state, arrived edges, and scroll directions.
 *
 * @param target - Scroll target element or window
 * @param options - Configuration options
 */
export function useScroll(
  target?: MaybeRef<HTMLElement | Window | Document | null>,
  options?: UseScrollOptions,
): UseScrollReturn {
  const { throttle = 0, offset = {} } = options ?? {}
  const offsetTop = offset.top ?? 0
  const offsetBottom = offset.bottom ?? 0
  const offsetLeft = offset.left ?? 0
  const offsetRight = offset.right ?? 0

  const x = ref(0)
  const y = ref(0)
  const isScrolling = ref(false)
  const arrivedTop = ref(true)
  const arrivedBottom = ref(false)
  const arrivedLeft = ref(true)
  const arrivedRight = ref(false)
  const dirTop = ref(false)
  const dirBottom = ref(false)
  const dirLeft = ref(false)
  const dirRight = ref(false)

  let scrollingTimer: ReturnType<typeof setTimeout> | undefined
  let lastX = 0
  let lastY = 0
  let throttleTimer: ReturnType<typeof setTimeout> | undefined
  let isThrottled = false

  function getScrollPosition(el: HTMLElement | Window | Document): { scrollLeft: number, scrollTop: number, scrollHeight: number, scrollWidth: number, clientHeight: number, clientWidth: number } {
    // Check for Window-like object (SSR-safe, no instanceof)
    if (typeof window !== 'undefined' && el === window || 'innerHeight' in el && 'scrollX' in el) {
      const win = el as Window
      const doc = typeof document !== 'undefined' ? document : undefined
      return {
        scrollLeft: win.scrollX ?? (win as any).pageXOffset ?? 0,
        scrollTop: win.scrollY ?? (win as any).pageYOffset ?? 0,
        scrollHeight: doc?.documentElement?.scrollHeight ?? 0,
        scrollWidth: doc?.documentElement?.scrollWidth ?? 0,
        clientHeight: win.innerHeight,
        clientWidth: win.innerWidth,
      }
    }

    // Check for Document-like object (SSR-safe, no instanceof)
    if (typeof document !== 'undefined' && el === document || 'documentElement' in el) {
      const docEl = (el as Document).documentElement
      return {
        scrollLeft: docEl.scrollLeft,
        scrollTop: docEl.scrollTop,
        scrollHeight: docEl.scrollHeight,
        scrollWidth: docEl.scrollWidth,
        clientHeight: docEl.clientHeight,
        clientWidth: docEl.clientWidth,
      }
    }

    const htmlEl = el as HTMLElement
    return {
      scrollLeft: htmlEl.scrollLeft,
      scrollTop: htmlEl.scrollTop,
      scrollHeight: htmlEl.scrollHeight,
      scrollWidth: htmlEl.scrollWidth,
      clientHeight: htmlEl.clientHeight,
      clientWidth: htmlEl.clientWidth,
    }
  }

  function update(): void {
    const el = target ? unref(target) : (typeof window !== 'undefined' ? window : null)
    if (!el)
      return

    const pos = getScrollPosition(el)

    // Update directions
    dirTop.value = pos.scrollTop < lastY
    dirBottom.value = pos.scrollTop > lastY
    dirLeft.value = pos.scrollLeft < lastX
    dirRight.value = pos.scrollLeft > lastX

    lastX = pos.scrollLeft
    lastY = pos.scrollTop

    x.value = pos.scrollLeft
    y.value = pos.scrollTop

    // Update arrived state
    arrivedTop.value = pos.scrollTop <= offsetTop
    arrivedLeft.value = pos.scrollLeft <= offsetLeft
    arrivedBottom.value = pos.scrollTop + pos.clientHeight >= pos.scrollHeight - offsetBottom
    arrivedRight.value = pos.scrollLeft + pos.clientWidth >= pos.scrollWidth - offsetRight

    // Mark scrolling
    isScrolling.value = true
    if (scrollingTimer)
      clearTimeout(scrollingTimer)
    scrollingTimer = setTimeout(() => {
      isScrolling.value = false
    }, 150)
  }

  function onScroll(): void {
    if (throttle > 0) {
      if (!isThrottled) {
        update()
        isThrottled = true
        throttleTimer = setTimeout(() => {
          isThrottled = false
        }, throttle)
      }
    }
    else {
      update()
    }
  }

  if (typeof window !== 'undefined') {
    const el = target ? unref(target) : window
    if (el) {
      // Read initial position
      const pos = getScrollPosition(el)
      x.value = pos.scrollLeft
      y.value = pos.scrollTop
      lastX = pos.scrollLeft
      lastY = pos.scrollTop
      arrivedTop.value = pos.scrollTop <= offsetTop
      arrivedLeft.value = pos.scrollLeft <= offsetLeft
      arrivedBottom.value = pos.scrollTop + pos.clientHeight >= pos.scrollHeight - offsetBottom
      arrivedRight.value = pos.scrollLeft + pos.clientWidth >= pos.scrollWidth - offsetRight

      el.addEventListener('scroll', onScroll, { passive: true })

      try {
        onUnmounted(() => {
          el.removeEventListener('scroll', onScroll)
          if (scrollingTimer)
            clearTimeout(scrollingTimer)
          if (throttleTimer)
            clearTimeout(throttleTimer)
        })
      }
      catch {
        // Not in a component context
      }
    }
  }

  return {
    x,
    y,
    isScrolling,
    arrivedState: {
      top: arrivedTop,
      bottom: arrivedBottom,
      left: arrivedLeft,
      right: arrivedRight,
    },
    directions: {
      top: dirTop,
      bottom: dirBottom,
      left: dirLeft,
      right: dirRight,
    },
  }
}
