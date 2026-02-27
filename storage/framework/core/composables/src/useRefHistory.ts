import type { Ref } from '@stacksjs/stx'
import { computed, ref, watch } from '@stacksjs/stx'

export interface UseRefHistoryRecord<T> {
  snapshot: T
  timestamp: number
}

export interface UseRefHistoryOptions {
  capacity?: number
  deep?: boolean
  clone?: boolean
}

export interface UseRefHistoryReturn<T> {
  history: Ref<UseRefHistoryRecord<T>[]>
  commit: () => void
  undo: () => void
  redo: () => void
  canUndo: Ref<boolean>
  canRedo: Ref<boolean>
  clear: () => void
  last: Ref<UseRefHistoryRecord<T>>
}

function cloneValue<T>(val: T, shouldClone: boolean): T {
  if (!shouldClone) return val
  if (typeof structuredClone === 'function') {
    return structuredClone(val)
  }
  return JSON.parse(JSON.stringify(val)) as T
}

/**
 * Auto-tracked ref history with undo/redo.
 * Automatically commits a snapshot on every change to the source ref.
 *
 * @param source - The reactive source to track
 * @param options - Capacity limit, deep watching, and clone behavior
 */
export function useRefHistory<T>(
  source: Ref<T>,
  options: UseRefHistoryOptions = {},
): UseRefHistoryReturn<T> {
  const { capacity = Infinity, deep = false, clone = false } = options

  const undoStack = ref<UseRefHistoryRecord<T>[]>([
    { snapshot: cloneValue(source.value, clone), timestamp: Date.now() },
  ]) as Ref<UseRefHistoryRecord<T>[]>

  const redoStack = ref<UseRefHistoryRecord<T>[]>([]) as Ref<UseRefHistoryRecord<T>[]>

  let isUndoRedoing = false

  const canUndo = computed<boolean>(() => undoStack.value.length > 1)
  const canRedo = computed<boolean>(() => redoStack.value.length > 0)

  const last = computed<UseRefHistoryRecord<T>>(() => {
    return undoStack.value[undoStack.value.length - 1]
  })

  function commit(): void {
    const record: UseRefHistoryRecord<T> = {
      snapshot: cloneValue(source.value, clone),
      timestamp: Date.now(),
    }
    undoStack.value = [...undoStack.value, record]

    if (capacity !== Infinity && undoStack.value.length > capacity) {
      undoStack.value = undoStack.value.slice(undoStack.value.length - capacity)
    }

    redoStack.value = []
  }

  function undo(): void {
    if (undoStack.value.length <= 1) return

    isUndoRedoing = true

    const current = undoStack.value[undoStack.value.length - 1]
    const newUndoStack = undoStack.value.slice(0, -1)
    undoStack.value = newUndoStack

    redoStack.value = [...redoStack.value, current]

    const previous = newUndoStack[newUndoStack.length - 1]
    source.value = cloneValue(previous.snapshot, clone)

    isUndoRedoing = false
  }

  function redo(): void {
    if (redoStack.value.length === 0) return

    isUndoRedoing = true

    const next = redoStack.value[redoStack.value.length - 1]
    redoStack.value = redoStack.value.slice(0, -1)

    undoStack.value = [...undoStack.value, next]

    source.value = cloneValue(next.snapshot, clone)

    isUndoRedoing = false
  }

  function clear(): void {
    undoStack.value = [
      { snapshot: cloneValue(source.value, clone), timestamp: Date.now() },
    ]
    redoStack.value = []
  }

  // Auto-commit on source changes
  watch(source, () => {
    if (!isUndoRedoing) {
      commit()
    }
  }, { deep })

  return {
    history: undoStack,
    commit,
    undo,
    redo,
    canUndo,
    canRedo,
    clear,
    last,
  }
}
