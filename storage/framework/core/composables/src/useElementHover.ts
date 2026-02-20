import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'
import type { MaybeRef } from './_shared'
import { unref } from './_shared'

/**
 * Reactive element hover state.
 *
 * @param target - The target element or a ref to one
 * @returns A ref that is true when the element is being hovered
 */
export function useElementHover(target: MaybeRef<HTMLElement | null | undefined>): Ref<boolean> {
  const isHovered = ref(false)

  let cleanup = (): void => {}

  function setup(el: HTMLElement | null | undefined): void {
    cleanup()
    if (!el) return

    const onEnter = (): void => { isHovered.value = true }
    const onLeave = (): void => { isHovered.value = false }

    el.addEventListener('mouseenter', onEnter, { passive: true })
    el.addEventListener('mouseleave', onLeave, { passive: true })

    cleanup = () => {
      el.removeEventListener('mouseenter', onEnter)
      el.removeEventListener('mouseleave', onLeave)
      cleanup = () => {}
    }
  }

  setup(unref(target) as HTMLElement | null | undefined)

  try {
    onUnmounted(() => cleanup())
  }
  catch {
    // Not in a component context
  }

  return isHovered
}
