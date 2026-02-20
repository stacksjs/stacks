import type { Ref } from '@stacksjs/stx'
import { useManualRefHistory } from './useManualRefHistory'
import { watch } from '@stacksjs/stx'

/**
 * Like useRefHistory but debounces automatic commits.
 */
export function useDebouncedRefHistory<T>(
  source: Ref<T>,
  options?: { capacity?: number, clone?: boolean, debounce?: number },
) {
  const delay = options?.debounce ?? 200
  const { history, commit, undo, redo, canUndo, canRedo, clear, last } = useManualRefHistory(source, options)

  let timer: ReturnType<typeof setTimeout> | null = null
  let ignoreNext = false

  watch(source, () => {
    if (ignoreNext) {
      ignoreNext = false
      return
    }
    if (timer !== null)
      clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      commit()
    }, delay)
  })

  const origUndo = undo
  const origRedo = redo

  function debouncedUndo(): void {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    ignoreNext = true
    origUndo()
  }

  function debouncedRedo(): void {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    ignoreNext = true
    origRedo()
  }

  return { history, commit, undo: debouncedUndo, redo: debouncedRedo, canUndo, canRedo, clear, last }
}
