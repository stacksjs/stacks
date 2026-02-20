import { onUnmounted } from '@stacksjs/stx'

/**
 * Detect when the user starts typing.
 * Fires when a keydown event produces a printable character and the active element is not an input.
 *
 * @param callback - Called when typing starts
 * @returns A cleanup function
 */
export function onStartTyping(callback: (event: KeyboardEvent) => void): () => void {
  if (typeof document === 'undefined')
    return () => {}

  const handler = (e: KeyboardEvent): void => {
    // Ignore if already focused on an input/textarea/contentEditable
    const active = document.activeElement
    if (active) {
      const tag = active.tagName.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || (active as HTMLElement).isContentEditable)
        return
    }

    // Only trigger on printable characters (single character keys)
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey)
      callback(e)
  }

  document.addEventListener('keydown', handler)

  const cleanup = (): void => {
    document.removeEventListener('keydown', handler)
  }

  try {
    onUnmounted(cleanup)
  }
  catch {
    // Not in a component context
  }

  return cleanup
}
