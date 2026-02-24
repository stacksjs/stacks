import { onUnmounted } from '@stacksjs/stx'

export type EventBusListener<T = any> = (_event: T) => void

export interface UseEventBusReturn<T = any> {
  on: (listener: EventBusListener<T>) => () => void
  once: (listener: EventBusListener<T>) => () => void
  emit: (event: T) => void
  off: (listener: EventBusListener<T>) => void
  reset: () => void
}

const buses = new Map<string | symbol, Set<EventBusListener>>()

/**
 * A reactive event bus for cross-component communication.
 *
 * @param key - A unique key identifying the event bus channel
 */
export function useEventBus<T = any>(key: string | symbol): UseEventBusReturn<T> {
  if (!buses.has(key))
    buses.set(key, new Set())

  const listeners = buses.get(key)!
  const localListeners: EventBusListener<T>[] = []

  function on(listener: EventBusListener<T>): () => void {
    listeners.add(listener)
    localListeners.push(listener)
    return () => off(listener)
  }

  function once(listener: EventBusListener<T>): () => void {
    const wrapper: EventBusListener<T> = (event) => {
      listener(event)
      off(wrapper)
    }
    return on(wrapper)
  }

  function emit(event: T): void {
    for (const listener of listeners)
      listener(event)
  }

  function off(listener: EventBusListener<T>): void {
    listeners.delete(listener)
    const idx = localListeners.indexOf(listener)
    if (idx !== -1)
      localListeners.splice(idx, 1)
  }

  function reset(): void {
    listeners.clear()
    localListeners.length = 0
  }

  try {
    onUnmounted(() => {
      for (const listener of localListeners)
        listeners.delete(listener)
      localListeners.length = 0
    })
  }
  catch {
    // Not in a component context
  }

  return { on, once, emit, off, reset }
}
