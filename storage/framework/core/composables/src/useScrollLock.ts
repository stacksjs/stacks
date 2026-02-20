import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref, watch } from '@stacksjs/stx'
import type { MaybeRef } from './_shared'
import { unref } from './_shared'

/**
 * Reactive scroll lock.
 * Returns a writable ref: set to true to lock scrolling, false to unlock.
 * Sets `overflow: hidden` on the target element.
 *
 * @param element - Target element to lock (defaults to document.body)
 */
export function useScrollLock(element?: MaybeRef<HTMLElement | null>): Ref<boolean> {
  const isLocked = ref(false)
  let originalOverflow = ''

  function getElement(): HTMLElement | null {
    if (element) {
      return unref(element)
    }
    if (typeof document !== 'undefined') {
      return document.body
    }
    return null
  }

  function lock(): void {
    const el = getElement()
    if (!el)
      return
    originalOverflow = el.style.overflow
    el.style.overflow = 'hidden'
  }

  function unlock(): void {
    const el = getElement()
    if (!el)
      return
    el.style.overflow = originalOverflow
  }

  watch(isLocked, (val) => {
    if (val) {
      lock()
    }
    else {
      unlock()
    }
  })

  try {
    onUnmounted(() => {
      if (isLocked.value) {
        unlock()
      }
    })
  }
  catch {
    // Not in a component context
  }

  return isLocked
}
