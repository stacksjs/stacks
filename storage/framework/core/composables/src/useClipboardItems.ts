import type { Ref } from '@stacksjs/stx'
import { ref } from '@stacksjs/stx'

export interface UseClipboardItemsReturn {
  isSupported: Ref<boolean>
  content: Ref<ClipboardItems>
  copy: (items: ClipboardItems) => Promise<void>
  read: () => Promise<void>
}

/**
 * Reactive ClipboardItems API for rich content (images, etc.).
 */
export function useClipboardItems(): UseClipboardItemsReturn {
  const isSupported = ref(
    typeof navigator !== 'undefined'
    && 'clipboard' in navigator
    && typeof ClipboardItem !== 'undefined',
  )
  const content = ref<ClipboardItems>([]) as Ref<ClipboardItems>

  async function copy(items: ClipboardItems): Promise<void> {
    if (isSupported.value) {
      await navigator.clipboard.write(items)
      content.value = items
    }
  }

  async function read(): Promise<void> {
    if (isSupported.value) {
      content.value = await navigator.clipboard.read()
    }
  }

  return { isSupported, content, copy, read }
}
