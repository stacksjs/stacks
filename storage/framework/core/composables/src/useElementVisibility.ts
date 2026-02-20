import type { Ref } from '@stacksjs/stx'
import { ref } from '@stacksjs/stx'
import { type MaybeRef } from './_shared'
import { useIntersectionObserver } from './useIntersectionObserver'

/**
 * Reactive element visibility.
 * Uses IntersectionObserver to track whether the target element is visible in the viewport.
 *
 * @param target - The element to observe (or a Ref to one)
 * @returns A ref that is true when the element is visible
 */
export function useElementVisibility(
  target: MaybeRef<HTMLElement | null>,
): Ref<boolean> {
  const isVisible = ref(false)

  useIntersectionObserver(
    target,
    (entries) => {
      for (const entry of entries) {
        isVisible.value = entry.isIntersecting
      }
    },
    { threshold: 0 },
  )

  return isVisible
}
