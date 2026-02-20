import type { Ref } from '@stacksjs/stx'
import { ref, watch } from '@stacksjs/stx'

export interface UseTextareaAutosizeReturn {
  textarea: Ref<HTMLTextAreaElement | null>
  input: Ref<string>
  triggerResize: () => void
}

/**
 * Automatically adjust textarea height based on content.
 */
export function useTextareaAutosize(
  options?: { element?: HTMLTextAreaElement, input?: string },
): UseTextareaAutosizeReturn {
  const textarea = ref<HTMLTextAreaElement | null>(options?.element ?? null) as Ref<HTMLTextAreaElement | null>
  const input = ref(options?.input ?? '')

  function triggerResize(): void {
    const el = textarea.value
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  watch(input, () => {
    if (textarea.value)
      textarea.value.value = input.value
    // Defer resize to next frame
    if (typeof requestAnimationFrame !== 'undefined')
      requestAnimationFrame(triggerResize)
    else
      triggerResize()
  })

  return { textarea, input, triggerResize }
}
