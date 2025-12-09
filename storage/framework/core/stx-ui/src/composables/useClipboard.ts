/**
 * useClipboard Composable
 * Reactive clipboard operations.
 */
import { ref, readonly } from 'vue'

export interface UseClipboardOptions {
  /**
   * Duration to show copied state (ms). Defaults to 2000.
   */
  copiedDuration?: number
}

export interface UseClipboardReturn {
  /**
   * Current clipboard text (if readable).
   */
  text: ReturnType<typeof readonly<ReturnType<typeof ref<string>>>>
  /**
   * Whether text was recently copied.
   */
  copied: ReturnType<typeof readonly<ReturnType<typeof ref<boolean>>>>
  /**
   * Whether clipboard is supported.
   */
  isSupported: ReturnType<typeof readonly<ReturnType<typeof ref<boolean>>>>
  /**
   * Copy text to clipboard.
   */
  copy: (text: string) => Promise<boolean>
  /**
   * Read text from clipboard.
   */
  read: () => Promise<string>
}

export function useClipboard(options: UseClipboardOptions = {}): UseClipboardReturn {
  const { copiedDuration = 2000 } = options

  const text = ref('')
  const copied = ref(false)
  const isSupported = ref(typeof navigator !== 'undefined' && !!navigator.clipboard)

  let timeoutId: ReturnType<typeof setTimeout> | null = null

  async function copy(value: string): Promise<boolean> {
    if (!isSupported.value) {
      console.warn('Clipboard API not supported')
      return false
    }

    try {
      await navigator.clipboard.writeText(value)
      text.value = value
      copied.value = true

      // Reset copied state after duration
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      timeoutId = setTimeout(() => {
        copied.value = false
      }, copiedDuration)

      return true
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
      return false
    }
  }

  async function read(): Promise<string> {
    if (!isSupported.value) {
      console.warn('Clipboard API not supported')
      return ''
    }

    try {
      const value = await navigator.clipboard.readText()
      text.value = value
      return value
    } catch (err) {
      console.error('Failed to read from clipboard:', err)
      return ''
    }
  }

  return {
    text: readonly(text),
    copied: readonly(copied),
    isSupported: readonly(isSupported),
    copy,
    read,
  }
}
