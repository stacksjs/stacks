import type { Ref } from '@stacksjs/stx'
import { ref } from '@stacksjs/stx'

export interface UseFileDialogOptions {
  /** Accepted file types (e.g., 'image/*', '.pdf') */
  accept?: string
  /** Allow multiple file selection */
  multiple?: boolean
  /** Capture setting for mobile */
  capture?: string
}

export interface UseFileDialogReturn {
  files: Ref<FileList | null>
  open: (options?: UseFileDialogOptions) => void
  reset: () => void
}

/**
 * Open a file selection dialog programmatically.
 */
export function useFileDialog(options: UseFileDialogOptions = {}): UseFileDialogReturn {
  const files = ref<FileList | null>(null) as Ref<FileList | null>

  function open(overrideOptions?: UseFileDialogOptions): void {
    if (typeof document === 'undefined') return

    const opts = { ...options, ...overrideOptions }
    const input = document.createElement('input')
    input.type = 'file'

    if (opts.accept) input.accept = opts.accept
    if (opts.multiple) input.multiple = true
    if (opts.capture) input.setAttribute('capture', opts.capture)

    input.onchange = () => {
      files.value = input.files
    }

    input.click()
  }

  function reset(): void {
    files.value = null
  }

  return { files, open, reset }
}
