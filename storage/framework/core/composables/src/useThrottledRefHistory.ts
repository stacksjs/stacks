import type { Ref } from '@stacksjs/stx'
import { watch } from '@stacksjs/stx'
import { useManualRefHistory } from './useManualRefHistory'

/**
 * Like useRefHistory but throttles automatic commits.
 */
export function useThrottledRefHistory<T>(
  source: Ref<T>,
  options?: { capacity?: number, clone?: boolean, throttle?: number },
) {
  const interval = options?.throttle ?? 200
  const { history, commit, undo, redo, canUndo, canRedo, clear, last } = useManualRefHistory(source, options)

  let lastCommit = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  let ignoreNext = false

  watch(source, () => {
    if (ignoreNext) {
      ignoreNext = false
      return
    }
    const now = Date.now()
    if (now - lastCommit >= interval) {
      lastCommit = now
      commit()
    }
    else {
      if (timer !== null) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        lastCommit = Date.now()
        commit()
      }, interval - (now - lastCommit))
    }
  })

  const origUndo = undo
  const origRedo = redo

  function throttledUndo(): void {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    ignoreNext = true
    origUndo()
  }

  function throttledRedo(): void {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    ignoreNext = true
    origRedo()
  }

  return { history, commit, undo: throttledUndo, redo: throttledRedo, canUndo, canRedo, clear, last }
}
