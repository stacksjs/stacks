import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'

/**
 * Reactive FPS (frames per second) counter.
 *
 * @param every - How many frames between updates. Default: 10
 */
export function useFps(every: number = 10): Ref<number> {
  const fps = ref(0)

  if (typeof requestAnimationFrame === 'undefined')
    return fps

  let last = performance.now()
  let ticks = 0
  let rafId: number

  function loop(): void {
    ticks++
    if (ticks >= every) {
      const now = performance.now()
      const diff = now - last
      fps.value = Math.round((ticks / diff) * 1000)
      last = now
      ticks = 0
    }
    rafId = requestAnimationFrame(loop)
  }

  rafId = requestAnimationFrame(loop)

  try {
    onUnmounted(() => cancelAnimationFrame(rafId))
  }
  catch {
    // Not in a component context
  }

  return fps
}
