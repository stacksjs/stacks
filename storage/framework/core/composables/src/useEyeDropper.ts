import type { Ref } from '@stacksjs/stx'
import { ref } from '@stacksjs/stx'

export interface UseEyeDropperReturn {
  isSupported: Ref<boolean>
  sRGBHex: Ref<string>
  open: () => Promise<{ sRGBHex: string } | undefined>
}

/**
 * Reactive EyeDropper API.
 */
export function useEyeDropper(): UseEyeDropperReturn {
  const isSupported = ref(typeof window !== 'undefined' && 'EyeDropper' in window)
  const sRGBHex = ref('')

  async function open(): Promise<{ sRGBHex: string } | undefined> {
    if (!isSupported.value) return undefined
    const dropper = new (window as any).EyeDropper()
    try {
      const result = await dropper.open()
      sRGBHex.value = result.sRGBHex
      return result
    }
    catch {
      // User canceled or error
      return undefined
    }
  }

  return { isSupported, sRGBHex, open }
}
