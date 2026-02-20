import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'
import { defaultWindow } from './_shared'

export interface UseWindowSizeOptions {
  /**
   * Initial width value for SSR.
   * @default 0
   */
  initialWidth?: number
  /**
   * Initial height value for SSR.
   * @default 0
   */
  initialHeight?: number
  /**
   * Listen for orientation change events.
   * @default true
   */
  listenOrientation?: boolean
}

export interface UseWindowSizeReturn {
  width: Ref<number>
  height: Ref<number>
}

/**
 * Reactive window dimensions.
 * Tracks window.innerWidth and window.innerHeight.
 */
export function useWindowSize(options?: UseWindowSizeOptions): UseWindowSizeReturn {
  const {
    initialWidth = 0,
    initialHeight = 0,
    listenOrientation = true,
  } = options ?? {}

  const win = defaultWindow()
  const width = ref(win ? win.innerWidth : initialWidth)
  const height = ref(win ? win.innerHeight : initialHeight)

  function update(): void {
    if (win) {
      width.value = win.innerWidth
      height.value = win.innerHeight
    }
  }

  if (win) {
    win.addEventListener('resize', update)

    if (listenOrientation) {
      win.addEventListener('orientationchange', update)
    }

    try {
      onUnmounted(() => {
        win.removeEventListener('resize', update)
        if (listenOrientation) {
          win.removeEventListener('orientationchange', update)
        }
      })
    }
    catch {
      // Not in a component context
    }
  }

  return { width, height }
}
