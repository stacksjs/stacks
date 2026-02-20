import type { Ref } from '@stacksjs/stx'
import { ref } from '@stacksjs/stx'

export interface UseAsyncStateOptions<T> {
  immediate?: boolean
  onError?: (e: unknown) => void
  resetOnExecute?: boolean
  delay?: number
}

export interface UseAsyncStateReturn<T> {
  state: Ref<T>
  isReady: Ref<boolean>
  isLoading: Ref<boolean>
  error: Ref<unknown>
  execute: (delay?: number) => Promise<T>
}

/**
 * Reactive async state management.
 * Wraps an async function or promise with reactive loading/error/ready state.
 *
 * @param promise - Async function or promise to execute
 * @param initialState - Initial state value
 * @param options - Execution options
 */
export function useAsyncState<T>(
  promise: (() => Promise<T>) | Promise<T>,
  initialState: T,
  options: UseAsyncStateOptions<T> = {},
): UseAsyncStateReturn<T> {
  const {
    immediate = true,
    onError,
    resetOnExecute = true,
    delay = 0,
  } = options

  const state = ref<T>(initialState) as Ref<T>
  const isReady = ref<boolean>(false)
  const isLoading = ref<boolean>(false)
  const error = ref<unknown>(undefined)

  async function execute(executeDelay?: number): Promise<T> {
    const delayMs = executeDelay ?? delay

    if (resetOnExecute) {
      state.value = initialState
    }

    error.value = undefined
    isReady.value = false
    isLoading.value = true

    if (delayMs > 0) {
      await new Promise<void>(resolve => setTimeout(resolve, delayMs))
    }

    try {
      const result = typeof promise === 'function' ? await promise() : await promise
      state.value = result
      isReady.value = true
      return result
    }
    catch (e) {
      error.value = e
      if (onError) {
        onError(e)
      }
      return state.value
    }
    finally {
      isLoading.value = false
    }
  }

  if (immediate) {
    execute()
  }

  return { state, isReady, isLoading, error, execute }
}
