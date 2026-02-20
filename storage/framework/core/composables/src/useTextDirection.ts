import type { Ref } from '@stacksjs/stx'
import { ref, watch } from '@stacksjs/stx'

export type TextDirection = 'ltr' | 'rtl' | 'auto'

/**
 * Reactive text direction of the document or element.
 *
 * @param target - Target element (defaults to document.documentElement)
 * @param initialValue - Initial direction value
 */
export function useTextDirection(
  target?: HTMLElement,
  initialValue?: TextDirection,
): Ref<TextDirection> {
  const el = target ?? (typeof document !== 'undefined' ? document.documentElement : null)

  let initial: TextDirection = initialValue ?? 'ltr'
  if (el) {
    const dir = el.getAttribute('dir')
    if (dir === 'rtl' || dir === 'ltr' || dir === 'auto')
      initial = dir
  }

  const direction = ref<TextDirection>(initial) as Ref<TextDirection>

  watch(direction, (val) => {
    if (el)
      el.setAttribute('dir', val)
  })

  return direction
}
