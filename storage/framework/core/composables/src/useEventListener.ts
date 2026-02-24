import { onUnmounted, watch } from '@stacksjs/stx'
import { type MaybeRef, isRef, unref, noop, defaultWindow } from './_shared'

type EventTarget = Window | Document | HTMLElement | Element

/**
 * Auto-cleanup event listener.
 * Registers an event listener on the target and automatically removes it on unmount.
 * Supports reactive targets via MaybeRef.
 *
 * @param target - The event target (Window, Document, HTMLElement, or a Ref to one)
 * @param event - The event name
 * @param handler - The event handler
 * @param options - AddEventListenerOptions
 * @returns A cleanup function to manually remove the listener
 */
export function useEventListener(
  target: MaybeRef<EventTarget | null | undefined> | EventTarget,
  event: string,
  handler: EventListenerOrEventListenerObject,
  options?: boolean | AddEventListenerOptions,
): () => void {
  let cleanup = noop

  const register = (el: EventTarget | null | undefined): (() => void) => {
    if (!el) return noop
    el.addEventListener(event, handler, options)
    return () => {
      el.removeEventListener(event, handler, options)
    }
  }

  if (isRef(target)) {
    // Watch the ref so that if the target changes, we re-bind
    watch(target, (_newTarget, _oldTarget) => {
      cleanup()
      cleanup = register(unref(target) as EventTarget | null | undefined)
    })
    // Initial registration
    cleanup = register((target as MaybeRef<EventTarget | null | undefined> as any).value)
  }
  else {
    cleanup = register(target as EventTarget | null | undefined)
  }

  const stop = (): void => {
    cleanup()
    cleanup = noop
  }

  try {
    onUnmounted(stop)
  }
  catch {
    // Not in a component context
  }

  return stop
}
