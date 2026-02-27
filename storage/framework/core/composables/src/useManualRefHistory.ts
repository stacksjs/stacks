import type { Ref } from '@stacksjs/stx'
import { computed, ref } from '@stacksjs/stx'

export interface UseManualRefHistoryRecord<T> {
  snapshot: T
  timestamp: number
}

export interface UseManualRefHistoryOptions {
  capacity?: number
  clone?: boolean
}

export interface UseManualRefHistoryReturn<T> {
  history: Ref<UseManualRefHistoryRecord<T>[]>
  commit: () => void
  undo: () => void
  redo: () => void
  canUndo: Ref<boolean>
  canRedo: Ref<boolean>
  clear: () => void
  last: Ref<UseManualRefHistoryRecord<T>>
}

function cloneValue<T>(val: T, shouldClone: boolean): T {
  if (!shouldClone) return val
  if (typeof structuredClone === 'function') {
    return structuredClone(val)
  }
  return JSON.parse(JSON.stringify(val)) as T
}

/**
 * Manual commit-based ref history tracking.
 * Provides undo/redo capabilities with manual commits.
 *
 * @param source - The reactive source to track
 * @param options - Capacity limit and clone behavior
 */
export function useManualRefHistory<T>(
  source: Ref<T>,
  options: UseManualRefHistoryOptions = {},
): UseManualRefHistoryReturn<T> {
  const { capacity = Infinity, clone = false } = options

  const undoStack = ref<UseManualRefHistoryRecord<T>[]>([
    { snapshot: cloneValue(source.value, clone), timestamp: Date.now() },
  ]) as Ref<UseManualRefHistoryRecord<T>[]>

  const redoStack = ref<UseManualRefHistoryRecord<T>[]>([]) as Ref<UseManualRefHistoryRecord<T>[]>

  // Pointer into undoStack: index of the "current" snapshot
  // undoStack[0] is always the initial state

  const canUndo = computed<boolean>(() => undoStack.value.length > 1)
  const canRedo = computed<boolean>(() => redoStack.value.length > 0)

  const last = computed<UseManualRefHistoryRecord<T>>(() => {
    return undoStack.value[undoStack.value.length - 1]
  })

  function commit(): void {
    const record: UseManualRefHistoryRecord<T> = {
      snapshot: cloneValue(source.value, clone),
      timestamp: Date.now(),
    }
    undoStack.value = [...undoStack.value, record]

    // Enforce capacity (keep the most recent entries)
    if (capacity !== Infinity && undoStack.value.length > capacity) {
      undoStack.value = undoStack.value.slice(undoStack.value.length - capacity)
    }

    // Clear redo stack on new commit
    redoStack.value = []
  }

  function undo(): void {
    if (undoStack.value.length <= 1) return

    const current = undoStack.value[undoStack.value.length - 1]
    const newUndoStack = undoStack.value.slice(0, -1)
    undoStack.value = newUndoStack

    redoStack.value = [...redoStack.value, current]

    const previous = newUndoStack[newUndoStack.length - 1]
    source.value = cloneValue(previous.snapshot, clone)
  }

  function redo(): void {
    if (redoStack.value.length === 0) return

    const next = redoStack.value[redoStack.value.length - 1]
    redoStack.value = redoStack.value.slice(0, -1)

    undoStack.value = [...undoStack.value, next]

    source.value = cloneValue(next.snapshot, clone)
  }

  function clear(): void {
    undoStack.value = [
      { snapshot: cloneValue(source.value, clone), timestamp: Date.now() },
    ]
    redoStack.value = []
  }

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
