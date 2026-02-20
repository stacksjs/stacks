import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'
import type { MaybeRefOrGetter } from './_shared'
import { toValue } from './_shared'

export type EventSourceStatus = 'CONNECTING' | 'OPEN' | 'CLOSED'

export interface UseEventSourceOptions {
  /**
   * Whether to send credentials (cookies) with the request.
   * @default false
   */
  withCredentials?: boolean
  /**
   * Whether to connect immediately on creation.
   * @default true
   */
  immediate?: boolean
}

export interface UseEventSourceReturn {
  /** The latest event data received. */
  data: Ref<string | null>
  /** The latest event type received. */
  event: Ref<string | null>
  /** The current connection status. */
  status: Ref<EventSourceStatus>
  /** The latest error, if any. */
  error: Ref<Event | null>
  /** The raw EventSource instance. */
  eventSource: Ref<EventSource | null>
  /** Close the EventSource connection. */
  close: () => void
  /** Open (or reopen) the EventSource connection. */
  open: () => void
}

/**
 * Reactive Server-Sent Events (EventSource) connection.
 *
 * @param url - The EventSource URL (can be a ref, getter, or raw string)
 * @param events - Array of event names to listen for (in addition to 'message')
 * @param options - Configuration options
 * @returns Reactive EventSource state and control methods
 *
 * @example
 * ```ts
 * const { data, event, status, close } = useEventSource('/api/events', ['update', 'delete'], {
 *   withCredentials: true,
 * })
 * ```
 */
export function useEventSource(
  url: MaybeRefOrGetter<string>,
  events: string[] = [],
  options: UseEventSourceOptions = {},
): UseEventSourceReturn {
  const {
    withCredentials = false,
    immediate = true,
  } = options

  const data = ref<string | null>(null) as Ref<string | null>
  const event = ref<string | null>(null) as Ref<string | null>
  const status = ref<EventSourceStatus>('CLOSED') as Ref<EventSourceStatus>
  const error = ref<Event | null>(null) as Ref<Event | null>
  const eventSourceRef = ref<EventSource | null>(null) as Ref<EventSource | null>

  let listeners: Array<{ eventName: string, handler: (e: Event) => void }> = []

  function close(): void {
    const es = eventSourceRef.value
    if (es) {
      // Remove all custom listeners
      for (const { eventName, handler } of listeners) {
        es.removeEventListener(eventName, handler)
      }
      listeners = []
      es.close()
      eventSourceRef.value = null
      status.value = 'CLOSED'
    }
  }

  function open(): void {
    if (typeof EventSource === 'undefined') return

    close()

    const resolvedUrl = toValue(url)
    status.value = 'CONNECTING'

    const es = new EventSource(resolvedUrl, { withCredentials })
    eventSourceRef.value = es

    es.onopen = () => {
      status.value = 'OPEN'
      error.value = null
    }

    es.onerror = (e: Event) => {
      error.value = e
      if (es.readyState === EventSource.CLOSED) {
        status.value = 'CLOSED'
      }
      else {
        status.value = 'CONNECTING'
      }
    }

    // Default 'message' event handler
    const messageHandler = (e: Event): void => {
      const messageEvent = e as MessageEvent
      data.value = messageEvent.data
      event.value = 'message'
    }
    es.addEventListener('message', messageHandler)
    listeners.push({ eventName: 'message', handler: messageHandler })

    // Custom event handlers
    for (const eventName of events) {
      const handler = (e: Event): void => {
        const messageEvent = e as MessageEvent
        data.value = messageEvent.data
        event.value = eventName
      }
      es.addEventListener(eventName, handler)
      listeners.push({ eventName, handler })
    }
  }

  if (immediate) {
    open()
  }

  try {
    onUnmounted(() => {
      close()
    })
  }
  catch {
    // Not in a component context
  }

  return {
    data,
    event,
    status,
    error,
    eventSource: eventSourceRef,
    close,
    open,
  }
}
