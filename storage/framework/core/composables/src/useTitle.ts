import type { Ref } from '@stacksjs/stx'
import { ref, watch } from '@stacksjs/stx'
import type { MaybeRefOrGetter } from './_shared'
import { defaultDocument, toValue } from './_shared'

/**
 * Reactive document title.
 * Returns a writable ref synced with document.title.
 * If no argument is provided, reads the current document title.
 *
 * @param newTitle - Optional initial title (or ref/getter)
 */
export function useTitle(newTitle?: MaybeRefOrGetter<string>): Ref<string> {
  const doc = defaultDocument()

  const initialTitle = newTitle !== undefined
    ? toValue(newTitle)
    : (doc?.title ?? '')

  const title = ref(initialTitle)

  // Apply initial title to document
  if (doc && newTitle !== undefined) {
    doc.title = title.value
  }

  // Watch for changes from the ref and sync to document
  watch(title, (val) => {
    if (doc) {
      doc.title = val
    }
  })

  return title
}
