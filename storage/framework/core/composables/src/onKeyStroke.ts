import type { MaybeRef } from './_shared'
import { defaultWindow, unref } from './_shared'

export interface OnKeyStrokeOptions {
  /**
   * Keyboard event name to listen for.
   * @default 'keydown'
   */
  eventName?: 'keydown' | 'keyup' | 'keypress'
  /**
   * Target element to listen on.
   * @default window
   */
  target?: MaybeRef<EventTarget | null>
}

type KeyFilter = string | string[] | ((_event: KeyboardEvent) => boolean)

/**
 * Listen for specific key strokes.
 * Calls the handler when the specified key is pressed.
 *
 * @param key - Key(s) to listen for, or a filter function
 * @param handler - Callback when key is pressed
 * @param options - Configuration options
 * @returns Cleanup function to remove the listener
 */
export function onKeyStroke(
  key: KeyFilter,
  handler: (event: KeyboardEvent) => void,
  options?: OnKeyStrokeOptions,
): () => void {
  const { eventName = 'keydown', target } = options ?? {}
  const win = defaultWindow()

  const eventTarget = target ? unref(target) : win
  if (!eventTarget) {
    return () => {}
  }

  function createKeyFilter(keyDef: KeyFilter): (event: KeyboardEvent) => boolean {
    if (typeof keyDef === 'function') {
      return keyDef
    }
    if (typeof keyDef === 'string') {
      return (event: KeyboardEvent) => event.key === keyDef
    }
    if (Array.isArray(keyDef)) {
      return (event: KeyboardEvent) => keyDef.includes(event.key)
    }
    return () => true
  }

  const filter = createKeyFilter(key)

  function listener(event: Event): void {
    const keyEvent = event as KeyboardEvent
    if (filter(keyEvent)) {
      handler(keyEvent)
    }
  }

  eventTarget.addEventListener(eventName, listener)

  const cleanup = (): void => {
    eventTarget.removeEventListener(eventName, listener)
  }

  return cleanup
}

/**
 * Listen for keydown events on specific keys.
 * Alias for onKeyStroke with eventName: 'keydown'.
 */
export function onKeyDown(
  key: KeyFilter,
  handler: (event: KeyboardEvent) => void,
  options?: Omit<OnKeyStrokeOptions, 'eventName'>,
): () => void {
  return onKeyStroke(key, handler, { ...options, eventName: 'keydown' })
}

/**
 * Listen for keyup events on specific keys.
 * Alias for onKeyStroke with eventName: 'keyup'.
 */
export function onKeyUp(
  key: KeyFilter,
  handler: (event: KeyboardEvent) => void,
  options?: Omit<OnKeyStrokeOptions, 'eventName'>,
): () => void {
  return onKeyStroke(key, handler, { ...options, eventName: 'keyup' })
}
