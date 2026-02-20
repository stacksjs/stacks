import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref, watch } from '@stacksjs/stx'

/**
 * Reactive URL representing an object (Blob/File).
 * The URL is automatically revoked when the source changes or on unmount.
 *
 * @param source - A ref containing a Blob, File, MediaSource, or null/undefined
 */
export function useObjectUrl(source: Ref<Blob | File | MediaSource | null | undefined>): Ref<string | undefined> {
  const url = ref<string | undefined>(undefined)

  function release(): void {
    if (url.value) {
      URL.revokeObjectURL(url.value)
      url.value = undefined
    }
  }

  function update(val: Blob | File | MediaSource | null | undefined): void {
    release()
    if (val)
      url.value = URL.createObjectURL(val)
  }

  // Initial
  update(source.value)

  watch(source, (val) => {
    update(val)
  })

  try {
    onUnmounted(() => release())
  }
  catch {
    // Not in a component context
  }

  return url
}
