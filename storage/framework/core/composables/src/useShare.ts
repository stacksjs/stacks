import type { Ref } from '@stacksjs/stx'
import { ref } from '@stacksjs/stx'

export interface UseShareOptions {
  title?: string
  text?: string
  url?: string
  files?: File[]
}

export interface UseShareReturn {
  share: (overrideOptions?: UseShareOptions) => Promise<void>
  isSupported: Ref<boolean>
}

/**
 * Reactive Web Share API.
 */
export function useShare(options: UseShareOptions = {}): UseShareReturn {
  const isSupported = ref(typeof navigator !== 'undefined' && 'share' in navigator)

  async function share(overrideOptions?: UseShareOptions): Promise<void> {
    if (!isSupported.value)
      return

    const shareData = { ...options, ...overrideOptions }
    await navigator.share(shareData as ShareData)
  }

  return { share, isSupported }
}
