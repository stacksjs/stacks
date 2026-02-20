import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'
import { type MaybeRef, unref, noop } from './_shared'

export interface UseDropZoneReturn {
  isOverDropZone: Ref<boolean>
  files: Ref<File[] | null>
}

/**
 * Drop zone for drag and drop files.
 * Tracks when files are dragged over the target element and captures dropped files.
 *
 * @param target - The drop zone element (or a Ref to one)
 * @param onDrop - Optional callback called when files are dropped
 * @returns Reactive isOverDropZone state and dropped files
 */
export function useDropZone(
  target: MaybeRef<HTMLElement | null>,
  onDrop?: (files: File[] | null) => void,
): UseDropZoneReturn {
  const isOverDropZone = ref(false)
  const files = ref<File[] | null>(null)

  let cleanup = noop
  let dragCounter = 0

  if (typeof window !== 'undefined') {
    const el = unref(target)

    if (el) {
      const cleanups: Array<() => void> = []

      const onDragEnter = (event: DragEvent): void => {
        event.preventDefault()
        dragCounter++
        isOverDropZone.value = true
      }

      const onDragOver = (event: DragEvent): void => {
        event.preventDefault()
        // Keep isOverDropZone true during drag over
        isOverDropZone.value = true
      }

      const onDragLeave = (event: DragEvent): void => {
        event.preventDefault()
        dragCounter--
        if (dragCounter <= 0) {
          dragCounter = 0
          isOverDropZone.value = false
        }
      }

      const onDropHandler = (event: DragEvent): void => {
        event.preventDefault()
        dragCounter = 0
        isOverDropZone.value = false

        const droppedFiles = event.dataTransfer?.files
        if (droppedFiles && droppedFiles.length > 0) {
          files.value = Array.from(droppedFiles)
        }
        else {
          files.value = null
        }

        if (onDrop) {
          onDrop(files.value)
        }
      }

      el.addEventListener('dragenter', onDragEnter)
      el.addEventListener('dragover', onDragOver)
      el.addEventListener('dragleave', onDragLeave)
      el.addEventListener('drop', onDropHandler)

      cleanups.push(
        () => el.removeEventListener('dragenter', onDragEnter),
        () => el.removeEventListener('dragover', onDragOver),
        () => el.removeEventListener('dragleave', onDragLeave),
        () => el.removeEventListener('drop', onDropHandler),
      )

      cleanup = () => {
        for (const fn of cleanups) fn()
        cleanups.length = 0
        cleanup = noop
      }
    }
  }

  try {
    onUnmounted(() => cleanup())
  }
  catch {
    // Not in a component context
  }

  return { isOverDropZone, files }
}
