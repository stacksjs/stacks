import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref, watch } from '@stacksjs/stx'

export interface UseStyleTagOptions {
  /** Apply immediately. Default: true */
  immediate?: boolean
  /** A unique ID for the style tag */
  id?: string
  /** Media query */
  media?: string
}

export interface UseStyleTagReturn {
  id: string
  css: Ref<string>
  load: () => void
  unload: () => void
  isLoaded: Ref<boolean>
}

/**
 * Inject a style tag into the document head.
 */
export function useStyleTag(
  initialCss: string,
  options: UseStyleTagOptions = {},
): UseStyleTagReturn {
  const {
    immediate = true,
    id = `style-${Math.random().toString(36).slice(2, 9)}`,
    media,
  } = options

  const css = ref(initialCss)
  const isLoaded = ref(false)
  let styleEl: HTMLStyleElement | null = null

  function load(): void {
    if (typeof document === 'undefined') return
    if (styleEl) return

    styleEl = document.createElement('style')
    styleEl.id = id
    if (media) styleEl.media = media
    styleEl.textContent = css.value
    document.head.appendChild(styleEl)
    isLoaded.value = true
  }

  function unload(): void {
    if (styleEl) {
      styleEl.remove()
      styleEl = null
      isLoaded.value = false
    }
  }

  watch(css, (val) => {
    if (styleEl)
      styleEl.textContent = val
  })

  if (immediate)
    load()

  try {
    onUnmounted(() => unload())
  }
  catch {
    // Not in a component context
  }

  return { id, css, load, unload, isLoaded }
}
