import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'

export type ReducedMotionType = 'reduce' | 'no-preference'

/**
 * Reactive preferred reduced motion.
 */
export function usePreferredReducedMotion(): Ref<ReducedMotionType> {
  const motion = ref<ReducedMotionType>('no-preference') as Ref<ReducedMotionType>

  if (typeof window === 'undefined' || !window.matchMedia)
    return motion

  const mq = window.matchMedia('(prefers-reduced-motion: reduce)')

  function update(): void {
    motion.value = mq.matches ? 'reduce' : 'no-preference'
  }

  update()
  mq.addEventListener('change', update)

  try {
    onUnmounted(() => {
      mq.removeEventListener('change', update)
    })
  }
  catch {
    // Not in a component context
  }

  return motion
}
