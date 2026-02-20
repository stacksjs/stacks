import type { Ref } from '@stacksjs/stx'
import { ref, watch } from '@stacksjs/stx'
import type { MaybeRefOrGetter } from './_shared'
import { toValue } from './_shared'

/**
 * Reactive favicon.
 *
 * @param newIcon - URL of the favicon or a reactive ref/getter
 */
export function useFavicon(newIcon?: MaybeRefOrGetter<string | null | undefined>): Ref<string | null> {
  const favicon = ref<string | null>(toValue(newIcon ?? null) as string | null) as Ref<string | null>

  function applyIcon(icon: string | null): void {
    if (typeof document === 'undefined' || !icon)
      return

    let link = document.querySelector<HTMLLinkElement>('link[rel*="icon"]')
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      link.type = 'image/x-icon'
      document.head.appendChild(link)
    }
    link.href = icon
  }

  watch(favicon, (val) => {
    applyIcon(val)
  })

  // Apply initial icon
  applyIcon(favicon.value)

  return favicon
}
