import type { MaybeRef } from './_shared'
import { defaultWindow, unref } from './_shared'

export interface OnClickOutsideOptions {
  /**
   * Elements to ignore (clicks on these won't trigger the handler).
   */
  ignore?: MaybeRef<HTMLElement | null>[]
}

/**
 * Listen for clicks outside a target element.
 * Calls the handler when a click occurs outside the target element.
 *
 * @param target - Element to detect clicks outside of
 * @param handler - Callback when click outside is detected
 * @param options - Configuration options
 * @returns Cleanup function to remove the listener
 */
export function onClickOutside(
  target: MaybeRef<HTMLElement | null>,
  handler: (event: MouseEvent) => void,
  options?: OnClickOutsideOptions,
): () => void {
  const win = defaultWindow()
  if (!win) {
    return () => {}
  }

  const { ignore = [] } = options ?? {}

  function listener(event: Event): void {
    const el = unref(target)
    if (!el)
      return

    const mouseEvent = event as MouseEvent
    const composedPath = mouseEvent.composedPath?.() ?? []

    // Check if click is inside target
    if (el === mouseEvent.target || composedPath.includes(el) || el.contains(mouseEvent.target as Node)) {
      return
    }

    // Check if click is on an ignored element
    for (const ignored of ignore) {
      const ignoredEl = unref(ignored)
      if (ignoredEl && (ignoredEl === mouseEvent.target || composedPath.includes(ignoredEl) || ignoredEl.contains(mouseEvent.target as Node))) {
        return
      }
    }

    handler(mouseEvent)
  }

  win.addEventListener('pointerdown', listener, { passive: true })

  const cleanup = (): void => {
    win.removeEventListener('pointerdown', listener)
  }

  return cleanup
}
