import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'
import { noop } from './_shared'

/**
 * Page leave detection.
 * Returns a ref that is true when the mouse has left the page (document).
 * Uses mouseleave and mouseenter events on the document element.
 *
 * @returns A ref that is true when the mouse is outside the page
 */
export function usePageLeave(): Ref<boolean> {
  const isLeft = ref(false)

  let cleanup = noop

  if (typeof document !== 'undefined') {
    const cleanups: Array<() => void> = []

    const onLeave = (event: MouseEvent): void => {
      // Check if the mouse truly left the document
      if (event.clientY <= 0 || event.clientX <= 0
        || event.clientX >= (typeof window !== 'undefined' ? window.innerWidth : 0)
        || event.clientY >= (typeof window !== 'undefined' ? window.innerHeight : 0)) {
        isLeft.value = true
      }
    }

    const onEnter = (): void => {
      isLeft.value = false
    }

    document.documentElement.addEventListener('mouseleave', onLeave)
    document.documentElement.addEventListener('mouseenter', onEnter)

    cleanups.push(
      () => document.documentElement.removeEventListener('mouseleave', onLeave),
      () => document.documentElement.removeEventListener('mouseenter', onEnter),
    )

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

  return isLeft
}
