import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'
import type { MaybeRef } from './_shared'
import { defaultDocument, unref } from './_shared'

export interface UseFullscreenReturn {
  /** Whether the target is currently in fullscreen mode. */
  isFullscreen: Ref<boolean>
  /** Whether the Fullscreen API is supported. */
  isSupported: Ref<boolean>
  /** Enter fullscreen mode. */
  enter: () => Promise<void>
  /** Exit fullscreen mode. */
  exit: () => Promise<void>
  /** Toggle fullscreen mode. */
  toggle: () => Promise<void>
}

/**
 * Reactive Fullscreen API.
 * Enter, exit, and toggle fullscreen mode on an element.
 *
 * @param target - Target element (defaults to documentElement)
 */
export function useFullscreen(target?: MaybeRef<HTMLElement | null>): UseFullscreenReturn {
  const doc = defaultDocument()
  const isFullscreen = ref(false)
  const isSupported = ref(
    !!doc && (
      'fullscreenEnabled' in doc
      || 'webkitFullscreenEnabled' in doc
    ),
  )

  function getTarget(): HTMLElement | null {
    if (target) {
      return unref(target)
    }
    return doc?.documentElement ?? null
  }

  function getFullscreenElement(): Element | null {
    if (!doc)
      return null
    return (doc as any).fullscreenElement
      ?? (doc as any).webkitFullscreenElement
      ?? null
  }

  function updateState(): void {
    isFullscreen.value = getFullscreenElement() !== null
  }

  async function enter(): Promise<void> {
    if (!isSupported.value)
      return

    const el = getTarget()
    if (!el)
      return

    try {
      if (el.requestFullscreen) {
        await el.requestFullscreen()
      }
      else if ((el as any).webkitRequestFullscreen) {
        await (el as any).webkitRequestFullscreen()
      }
      isFullscreen.value = true
    }
    catch {
      // Fullscreen request failed
    }
  }

  async function exit(): Promise<void> {
    if (!isSupported.value || !doc)
      return

    try {
      if (doc.exitFullscreen) {
        await doc.exitFullscreen()
      }
      else if ((doc as any).webkitExitFullscreen) {
        await (doc as any).webkitExitFullscreen()
      }
      isFullscreen.value = false
    }
    catch {
      // Fullscreen exit failed
    }
  }

  async function toggle(): Promise<void> {
    if (isFullscreen.value) {
      await exit()
    }
    else {
      await enter()
    }
  }

  // Listen for fullscreen change events
  if (doc) {
    const handler = (): void => updateState()

    doc.addEventListener('fullscreenchange', handler)
    doc.addEventListener('webkitfullscreenchange', handler)

    try {
      onUnmounted(() => {
        doc.removeEventListener('fullscreenchange', handler)
        doc.removeEventListener('webkitfullscreenchange', handler)
      })
    }
    catch {
      // Not in a component context
    }
  }

  return {
    isFullscreen,
    isSupported,
    enter,
    exit,
    toggle,
  }
}
