import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'

export interface UseScriptTagOptions {
  /** Load the script immediately. Default: true */
  immediate?: boolean
  /** Script type attribute. Default: 'text/javascript' */
  type?: string
  /** Whether to add async attribute */
  async?: boolean
  /** Whether to add defer attribute */
  defer?: boolean
  /** crossOrigin attribute */
  crossOrigin?: string
  /** referrerPolicy attribute */
  referrerPolicy?: string
  /** Remove the script tag on unmount. Default: true */
  manual?: boolean
  /** Custom attributes */
  attrs?: Record<string, string>
}

export interface UseScriptTagReturn {
  scriptTag: Ref<HTMLScriptElement | null>
  load: () => Promise<HTMLScriptElement>
  unload: () => void
}

/**
 * Inject a script tag into the document.
 */
export function useScriptTag(
  src: string,
  onLoaded?: (el: HTMLScriptElement) => void,
  options: UseScriptTagOptions = {},
): UseScriptTagReturn {
  const {
    immediate = true,
    type = 'text/javascript',
    manual = false,
    attrs = {},
  } = options

  const scriptTag = ref<HTMLScriptElement | null>(null) as Ref<HTMLScriptElement | null>

  function load(): Promise<HTMLScriptElement> {
    return new Promise<HTMLScriptElement>((resolve, reject) => {
      if (typeof document === 'undefined') {
        reject(new Error('Document is not available'))
        return
      }

      const el = document.createElement('script')
      el.type = type
      el.src = src

      if (options.async) el.async = true
      if (options.defer) el.defer = true
      if (options.crossOrigin) el.crossOrigin = options.crossOrigin
      if (options.referrerPolicy) el.referrerPolicy = options.referrerPolicy

      for (const [key, value] of Object.entries(attrs))
        el.setAttribute(key, value)

      el.addEventListener('load', () => {
        scriptTag.value = el
        onLoaded?.(el)
        resolve(el)
      })

      el.addEventListener('error', (event) => {
        reject(event)
      })

      document.head.appendChild(el)
    })
  }

  function unload(): void {
    if (scriptTag.value) {
      scriptTag.value.remove()
      scriptTag.value = null
    }
  }

  if (immediate)
    load()

  if (!manual) {
    try {
      onUnmounted(() => unload())
    }
    catch {
      // Not in a component context
    }
  }

  return { scriptTag, load, unload }
}
