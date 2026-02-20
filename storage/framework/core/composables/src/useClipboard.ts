import type { Ref } from '@stacksjs/stx'
import { ref } from '@stacksjs/stx'
import type { MaybeRefOrGetter } from './_shared'
import { defaultNavigator, toValue } from './_shared'

export interface UseClipboardOptions {
  /**
   * Source of text to copy.
   */
  source?: MaybeRefOrGetter<string>
  /**
   * Duration (ms) that `copied` stays true after a successful copy.
   * @default 1500
   */
  copiedDuring?: number
}

export interface UseClipboardReturn {
  /** Current clipboard text (updated after copy). */
  text: Ref<string>
  /** Whether clipboard API is supported. */
  isSupported: Ref<boolean>
  /** Whether text was recently copied (resets after copiedDuring ms). */
  copied: Ref<boolean>
  /** Copy text to clipboard. If no argument, uses the source option. */
  copy: (text?: string) => Promise<void>
}

/**
 * Reactive Clipboard API.
 * Read and write to the clipboard reactively.
 */
export function useClipboard(options?: UseClipboardOptions): UseClipboardReturn {
  const {
    source,
    copiedDuring = 1500,
  } = options ?? {}

  const nav = defaultNavigator()
  const isSupported = ref(!!nav && 'clipboard' in nav)
  const text = ref('')
  const copied = ref(false)

  let copiedTimer: ReturnType<typeof setTimeout> | undefined

  async function copy(value?: string): Promise<void> {
    if (!isSupported.value)
      return

    const valueToCopy = value ?? (source !== undefined ? toValue(source) : undefined)
    if (valueToCopy === undefined)
      return

    try {
      await nav!.clipboard.writeText(valueToCopy)
      text.value = valueToCopy
      copied.value = true

      if (copiedTimer)
        clearTimeout(copiedTimer)

      copiedTimer = setTimeout(() => {
        copied.value = false
      }, copiedDuring)
    }
    catch {
      // Clipboard write failed (e.g. permission denied)
    }
  }

  return {
    text,
    isSupported,
    copied,
    copy,
  }
}
