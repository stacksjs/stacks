import type { Ref } from '@stacksjs/stx'
import { watch } from '@stacksjs/stx'

export interface SyncRefOptions {
  /**
   * Direction of sync: 'ltr' (left to right), 'rtl' (right to left), or 'both'.
   * @default 'both'
   */
  direction?: 'ltr' | 'rtl' | 'both'
}

/**
 * Two-way sync between two refs.
 *
 * @param left - First ref
 * @param right - Second ref
 * @param options - Sync direction options
 * @returns A stop function to cancel the sync
 */
export function syncRef<T>(left: Ref<T>, right: Ref<T>, options: SyncRefOptions = {}): () => void {
  const { direction = 'both' } = options
  let syncing = false

  const unwatchers: Array<() => void> = []

  if (direction === 'both' || direction === 'ltr') {
    unwatchers.push(watch(left, (val) => {
      if (syncing) return
      syncing = true
      right.value = val
      syncing = false
    }))
  }

  if (direction === 'both' || direction === 'rtl') {
    unwatchers.push(watch(right, (val) => {
      if (syncing) return
      syncing = true
      left.value = val
      syncing = false
    }))
  }

  return () => {
    for (const unwatch of unwatchers)
      unwatch()
  }
}

/**
 * Sync multiple source refs to a target ref.
 *
 * @param sources - Array of source refs
 * @param target - Target ref that will be updated when any source changes
 * @returns A stop function to cancel all watches
 */
export function syncRefs<T>(sources: Ref<T>[], target: Ref<T>): () => void {
  const unwatchers = sources.map(source =>
    watch(source, (val) => {
      target.value = val
    }),
  )

  return () => {
    for (const unwatch of unwatchers)
      unwatch()
  }
}
