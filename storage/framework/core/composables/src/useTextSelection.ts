import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'

export interface UseTextSelectionReturn {
  /** The selected text */
  text: Ref<string>
  /** The ranges in the selection */
  ranges: Ref<Range[]>
  /** The Selection object */
  selection: Ref<Selection | null>
}

/**
 * Reactively track the user's text selection.
 */
export function useTextSelection(): UseTextSelectionReturn {
  const text = ref('')
  const ranges = ref<Range[]>([])
  const selection = ref<Selection | null>(null) as Ref<Selection | null>

  if (typeof document === 'undefined')
    return { text, ranges, selection }

  const handler = (): void => {
    const sel = document.getSelection()
    selection.value = sel
    if (sel && sel.rangeCount > 0) {
      text.value = sel.toString()
      const newRanges: Range[] = []
      for (let i = 0; i < sel.rangeCount; i++)
        newRanges.push(sel.getRangeAt(i))
      ranges.value = newRanges
    }
    else {
      text.value = ''
      ranges.value = []
    }
  }

  document.addEventListener('selectionchange', handler, { passive: true })

  try {
    onUnmounted(() => {
      document.removeEventListener('selectionchange', handler)
    })
  }
  catch {
    // Not in a component context
  }

  return { text, ranges, selection }
}
