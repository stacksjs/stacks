import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'
import type { MaybeRef } from './_shared'
import { unref } from './_shared'

export interface UsePointerLockReturn {
  isSupported: Ref<boolean>
  isLocked: Ref<boolean>
  lock: (target?: HTMLElement) => Promise<void>
  unlock: () => void
  element: Ref<Element | null>
}

/**
 * Reactive Pointer Lock API.
 */
export function usePointerLock(
  target?: MaybeRef<HTMLElement | null | undefined>,
): UsePointerLockReturn {
  const isSupported = ref(typeof document !== 'undefined' && 'pointerLockElement' in document)
  const isLocked = ref(false)
  const element = ref<Element | null>(null) as Ref<Element | null>

  if (typeof document !== 'undefined') {
    const handler = (): void => {
      isLocked.value = !!document.pointerLockElement
      element.value = document.pointerLockElement
    }

    document.addEventListener('pointerlockchange', handler)
    document.addEventListener('pointerlockerror', handler)

    try {
      onUnmounted(() => {
        document.removeEventListener('pointerlockchange', handler)
        document.removeEventListener('pointerlockerror', handler)
      })
    }
    catch {
      // Not in a component context
    }
  }

  async function lock(el?: HTMLElement): Promise<void> {
    if (!isSupported.value) return
    const targetEl = el ?? unref(target) as HTMLElement | null
    if (targetEl)
      await targetEl.requestPointerLock()
  }

  function unlock(): void {
    if (!isSupported.value) return
    if (document.pointerLockElement)
      document.exitPointerLock()
  }

  return { isSupported, isLocked, lock, unlock, element }
}
