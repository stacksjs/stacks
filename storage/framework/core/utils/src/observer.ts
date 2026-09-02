/**
 * ResizeObserver polyfill (resize-observer-polyfill replacement)
 *
 * Note: Modern browsers all support ResizeObserver natively now.
 * This provides a simple fallback for older browsers.
 */

export interface ResizeObserverSize {
  readonly inlineSize: number
  readonly blockSize: number
}

export interface ResizeObserverEntry {
  readonly target: Element
  readonly contentRect: DOMRectReadOnly
  readonly borderBoxSize: ReadonlyArray<ResizeObserverSize>
  readonly contentBoxSize: ReadonlyArray<ResizeObserverSize>
  readonly devicePixelContentBoxSize: ReadonlyArray<ResizeObserverSize>
}

export type ResizeObserverCallback = (
  entries: ResizeObserverEntry[],
  observer: ResizeObserver,
) => void

/**
 * Check if ResizeObserver is supported natively
 */
export function isResizeObserverSupported(): boolean {
  return typeof window !== 'undefined' && 'ResizeObserver' in window
}

/**
 * Get ResizeObserver (native or polyfill)
 *
 * Modern browsers all support ResizeObserver, but this provides a fallback
 */
/**
 * The native `ResizeObserver`, or a polyfill constructor with the same shape.
 *
 * Typed as the constructor rather than `any`: the polyfill below already
 * declares `implements ResizeObserver`, so both branches genuinely satisfy it
 * and nothing had to be given up to say so. `any` here spread to the
 * `ResizeObserver` export beneath, so every consumer of the polyfill lost
 * `observe` / `unobserve` / `disconnect` checking.
 */
export function getResizeObserver(): new (_callback: ResizeObserverCallback) => ResizeObserver {
  if (isResizeObserverSupported()) {
    return window.ResizeObserver
  }

  // Simple polyfill for older browsers
  return class ResizeObserverPolyfill implements ResizeObserver {
    private callback: ResizeObserverCallback
    private observedElements: Set<Element> = new Set()
    private rafId: number | null = null
    /** True while inside `raf(...)`, so a synchronous callback cannot recurse. */
    private scheduling = false


    constructor(callback: ResizeObserverCallback) {
      this.callback = callback
    }

    observe(target: Element): void {
      if (!this.observedElements.has(target)) {
        this.observedElements.add(target)
        this.scheduleCheck()
      }
    }

    unobserve(target: Element): void {
      this.observedElements.delete(target)

      if (this.observedElements.size === 0 && this.rafId !== null) {
        const cancel = typeof cancelAnimationFrame !== 'undefined' ? cancelAnimationFrame : clearTimeout
        cancel(this.rafId)
        this.rafId = null
      }
    }

    disconnect(): void {
      this.observedElements.clear()

      if (this.rafId !== null) {
        const cancel = typeof cancelAnimationFrame !== 'undefined' ? cancelAnimationFrame : clearTimeout
        cancel(this.rafId)
        this.rafId = null
      }
    }

    private scheduleCheck(): void {
      /*
       * `scheduling` guards the window `rafId` cannot.
       *
       * `rafId` is only assigned AFTER `raf(...)` returns, so a
       * `requestAnimationFrame` that invokes its callback synchronously - a
       * polyfill, a test double, any non-browser host - runs the reschedule
       * while `rafId` is still null. The guard below never trips, and
       * `scheduleCheck` recurses into itself until the stack overflows, taking
       * the whole process down rather than failing one test
       * (stacksjs/stacks#2413).
       *
       * With a real, asynchronous rAF this flag is already false by the time
       * the callback runs, so polling continues exactly as before.
       */
      if (this.rafId !== null || this.scheduling) return

      // Use setTimeout as fallback if requestAnimationFrame is not available
      const raf = typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame : setTimeout

      this.scheduling = true

      try {
        this.rafId = raf(() => {
          this.check()
          this.rafId = null

          if (this.observedElements.size > 0) {
            this.scheduleCheck()
          }
        }) as number
      }
      finally {
        this.scheduling = false
      }
    }

    private check(): void {
      const entries: ResizeObserverEntry[] = []

      for (const element of this.observedElements) {
        const rect = element.getBoundingClientRect()

        const entry: ResizeObserverEntry = {
          target: element,
          contentRect: rect,
          borderBoxSize: [{ inlineSize: rect.width, blockSize: rect.height }],
          contentBoxSize: [{ inlineSize: rect.width, blockSize: rect.height }],
          devicePixelContentBoxSize: [{ inlineSize: rect.width, blockSize: rect.height }],
        }

        entries.push(entry)
      }

      if (entries.length > 0) {
        this.callback(entries, this)
      }
    }
  }
}

/**
 * Create a resize observer with automatic cleanup
 *
 * @example
 * ```ts
 * const cleanup = createResizeObserver((entries) => {
 *   for (const entry of entries) {
 *     console.log('Element resized:', entry.target)
 *   }
 * }, element)
 *
 * // Later, clean up
 * cleanup()
 * ```
 */
export function createResizeObserver(
  callback: ResizeObserverCallback,
  target: Element | Element[],
): () => void {
  const Observer = getResizeObserver()
  const observer = new Observer(callback)

  const targets = Array.isArray(target) ? target : [target]

  for (const element of targets) {
    observer.observe(element)
  }

  return () => {
    observer.disconnect()
  }
}

/**
 * Observe element size changes
 *
 * @example
 * ```ts
 * const stop = observeElementSize(element, (entry) => {
 *   console.log('Size:', entry.contentRect.width, entry.contentRect.height)
 * })
 *
 * // Stop observing
 * stop()
 * ```
 */
export function observeElementSize(
  element: Element,
  callback: (entry: ResizeObserverEntry) => void,
): () => void {
  return createResizeObserver((entries) => {
    const entry = entries.find(e => e.target === element)
    if (entry) {
      callback(entry)
    }
  }, element)
}

// Export the native ResizeObserver if available, or the polyfill
export const ResizeObserver: new (_callback: ResizeObserverCallback) => ResizeObserver = getResizeObserver()
export default ResizeObserver
