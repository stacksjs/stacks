import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'
import type { MaybeRef } from './_shared'
import { unref } from './_shared'

export interface UseAnimateReturn {
  isSupported: Ref<boolean>
  animate: Ref<Animation | undefined>
  play: () => void
  pause: () => void
  reverse: () => void
  finish: () => void
  cancel: () => void
  pending: Ref<boolean>
  playState: Ref<AnimationPlayState>
  currentTime: Ref<number | null>
}

/**
 * Reactive Web Animations API.
 */
export function useAnimate(
  target: MaybeRef<HTMLElement | null | undefined>,
  keyframes: Keyframe[] | PropertyIndexedKeyframes,
  options?: number | KeyframeAnimationOptions,
): UseAnimateReturn {
  const isSupported = ref(typeof HTMLElement !== 'undefined' && 'animate' in HTMLElement.prototype)
  const animate = ref<Animation | undefined>(undefined)
  const pending = ref(false)
  const playState = ref<AnimationPlayState>('idle') as Ref<AnimationPlayState>
  const currentTime = ref<number | null>(null) as Ref<number | null>

  function syncState(): void {
    if (animate.value) {
      pending.value = animate.value.pending
      playState.value = animate.value.playState
      currentTime.value = animate.value.currentTime as number | null
    }
  }

  function init(): void {
    const el = unref(target) as HTMLElement | null
    if (!el || !isSupported.value) return

    animate.value = el.animate(keyframes, options)
    animate.value.addEventListener('finish', syncState)
    animate.value.addEventListener('cancel', syncState)
    syncState()
  }

  function play(): void { animate.value?.play(); syncState() }
  function pause(): void { animate.value?.pause(); syncState() }
  function reverse(): void { animate.value?.reverse(); syncState() }
  function finish(): void { animate.value?.finish(); syncState() }
  function cancel(): void { animate.value?.cancel(); syncState() }

  init()

  try {
    onUnmounted(() => {
      animate.value?.cancel()
    })
  }
  catch {
    // Not in a component context
  }

  return { isSupported, animate, play, pause, reverse, finish, cancel, pending, playState, currentTime }
}
