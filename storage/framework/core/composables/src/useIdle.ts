import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'
import { noop } from './_shared'

export interface UseIdleOptions {
  /** Events that signal user activity */
  events?: string[]
  /** Initial idle state. Default: false */
  initialState?: boolean
}

export interface UseIdleReturn {
  idle: Ref<boolean>
  lastActive: Ref<number>
}

const DEFAULT_EVENTS: string[] = [
  'mousemove',
  'mousedown',
  'resize',
  'keydown',
  'touchstart',
  'wheel',
]

/**
 * User idle detection.
 * Tracks whether the user is idle based on activity events.
 *
 * @param timeout - Idle timeout in milliseconds. Default: 60000 (1 minute)
 * @param options - Configuration for events and initial state
 * @returns Reactive idle state and last active timestamp
 */
export function useIdle(
  timeout: number = 60000,
  options?: UseIdleOptions,
): UseIdleReturn {
  const events = options?.events ?? DEFAULT_EVENTS
  const initialState = options?.initialState ?? false

  const idle = ref(initialState)
  const lastActive = ref(Date.now())

  let timer: ReturnType<typeof setTimeout> | null = null
  let cleanup = noop

  if (typeof window !== 'undefined') {
    const cleanups: Array<() => void> = []

    const reset = (): void => {
      idle.value = false
      lastActive.value = Date.now()

      if (timer !== null) {
        clearTimeout(timer)
      }

      timer = setTimeout(() => {
        idle.value = true
      }, timeout)
    }

    for (const event of events) {
      window.addEventListener(event, reset, { passive: true })
      cleanups.push(() => window.removeEventListener(event, reset))
    }

    // Start the initial timer
    timer = setTimeout(() => {
      idle.value = true
    }, timeout)

    cleanup = () => {
      for (const fn of cleanups) fn()
      cleanups.length = 0
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
      cleanup = noop
    }
  }

  try {
    onUnmounted(() => cleanup())
  }
  catch {
    // Not in a component context
  }

  return { idle, lastActive }
}
