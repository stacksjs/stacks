import type { Ref } from '@stacksjs/stx'
import { ref } from '@stacksjs/stx'

export interface UseScreenSafeAreaReturn {
  top: Ref<string>
  right: Ref<string>
  bottom: Ref<string>
  left: Ref<string>
  update: () => void
}

/**
 * Reactive `env(safe-area-inset-*)` values.
 */
export function useScreenSafeArea(): UseScreenSafeAreaReturn {
  const top = ref('0px')
  const right = ref('0px')
  const bottom = ref('0px')
  const left = ref('0px')

  function update(): void {
    if (typeof document === 'undefined' || typeof getComputedStyle === 'undefined')
      return

    const div = document.createElement('div')
    div.style.position = 'fixed'
    div.style.top = 'env(safe-area-inset-top, 0px)'
    div.style.right = 'env(safe-area-inset-right, 0px)'
    div.style.bottom = 'env(safe-area-inset-bottom, 0px)'
    div.style.left = 'env(safe-area-inset-left, 0px)'
    div.style.pointerEvents = 'none'
    div.style.visibility = 'hidden'
    document.body.appendChild(div)

    const style = getComputedStyle(div)
    top.value = style.top
    right.value = style.right
    bottom.value = style.bottom
    left.value = style.left

    document.body.removeChild(div)
  }

  update()

  return { top, right, bottom, left, update }
}
