import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref, watch } from '@stacksjs/stx'
import type { MaybeRef } from './_shared'
import { unref } from './_shared'

export type TransitionFunction = (t: number) => number

export interface UseTransitionOptions {
  /** Duration in milliseconds. Default: 300 */
  duration?: number
  /** Easing function. Default: linear */
  transition?: TransitionFunction
  /** Delay before starting in ms */
  delay?: number
  /** Callback on completion */
  onFinished?: () => void
  /** Callback on start */
  onStarted?: () => void
}

// Common easing functions
export const TransitionPresets = {
  linear: (t: number) => t,
  easeInQuad: (t: number) => t * t,
  easeOutQuad: (t: number) => t * (2 - t),
  easeInOutQuad: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  easeInCubic: (t: number) => t * t * t,
  easeOutCubic: (t: number) => (--t) * t * t + 1,
  easeInOutCubic: (t: number) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
} as const

/**
 * Reactive value transition. Smoothly transitions between values over time.
 */
export function useTransition(
  source: MaybeRef<number>,
  options: UseTransitionOptions = {},
): Ref<number> {
  const {
    duration = 300,
    transition = TransitionPresets.linear,
    delay = 0,
    onFinished,
    onStarted,
  } = options

  const output = ref(unref(source))
  let rafId: number | null = null

  function startTransition(from: number, to: number): void {
    if (rafId !== null) cancelAnimationFrame(rafId)

    const start = performance.now() + delay
    onStarted?.()

    function tick(now: number): void {
      const elapsed = now - start
      if (elapsed < 0) {
        rafId = requestAnimationFrame(tick)
        return
      }

      const progress = Math.min(elapsed / duration, 1)
      const eased = transition(progress)
      output.value = from + (to - from) * eased

      if (progress < 1) {
        rafId = requestAnimationFrame(tick)
      }
      else {
        rafId = null
        output.value = to
        onFinished?.()
      }
    }

    rafId = requestAnimationFrame(tick)
  }

  if (typeof source === 'object' && source && 'value' in source && 'subscribe' in source) {
    watch(source as Ref<number>, (newValue) => {
      if (typeof requestAnimationFrame !== 'undefined')
        startTransition(output.value, newValue)
      else
        output.value = newValue
    })
  }

  try {
    onUnmounted(() => {
      if (rafId !== null) cancelAnimationFrame(rafId)
    })
  }
  catch {
    // Not in a component context
  }

  return output
}

/**
 * Execute a transition between values.
 */
export function executeTransition(
  from: number,
  to: number,
  options: UseTransitionOptions = {},
): Promise<void> {
  return new Promise((resolve) => {
    const {
      duration = 300,
      transition = TransitionPresets.linear,
      delay = 0,
      onFinished,
      onStarted,
    } = options

    if (typeof requestAnimationFrame === 'undefined') {
      onFinished?.()
      resolve()
      return
    }

    const start = performance.now() + delay
    onStarted?.()

    function tick(now: number): void {
      const elapsed = now - start
      if (elapsed < 0) {
        requestAnimationFrame(tick)
        return
      }

      const progress = Math.min(elapsed / duration, 1)
      if (progress >= 1) {
        onFinished?.()
        resolve()
      }
      else {
        requestAnimationFrame(tick)
      }
    }

    requestAnimationFrame(tick)
  })
}
