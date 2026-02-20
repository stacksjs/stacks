import type { Ref } from '@stacksjs/stx'
import { ref } from '@stacksjs/stx'

export type UseAsyncQueueTask<T> = () => Promise<T>

export interface UseAsyncQueueResult<T> {
  state: 'fulfilled' | 'rejected' | 'pending'
  data?: T
}

export interface UseAsyncQueueReturn<T> {
  activeIndex: Ref<number>
  result: Ref<UseAsyncQueueResult<T>[]>
  isFinished: Ref<boolean>
}

/**
 * Sequential async task queue.
 * Runs tasks one after another, tracking status and results.
 *
 * @param tasks - Array of async task functions to execute sequentially
 */
export function useAsyncQueue<T>(tasks: UseAsyncQueueTask<T>[]): UseAsyncQueueReturn<T> {
  const activeIndex = ref<number>(-1)
  const isFinished = ref<boolean>(false)

  const result = ref<UseAsyncQueueResult<T>[]>(
    tasks.map(() => ({ state: 'pending' as const })),
  ) as Ref<UseAsyncQueueResult<T>[]>

  async function runTasks(): Promise<void> {
    for (let i = 0; i < tasks.length; i++) {
      activeIndex.value = i
      try {
        const data = await tasks[i]()
        result.value = result.value.map((r, idx) =>
          idx === i ? { state: 'fulfilled' as const, data } : r,
        )
      }
      catch (e) {
        result.value = result.value.map((r, idx) =>
          idx === i ? { state: 'rejected' as const, data: e as T } : r,
        )
      }
    }
    activeIndex.value = tasks.length
    isFinished.value = true
  }

  runTasks()

  return { activeIndex, result, isFinished }
}
