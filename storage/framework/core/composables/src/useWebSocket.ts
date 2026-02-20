import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'
import type { MaybeRefOrGetter } from './_shared'
import { toValue } from './_shared'

export type WebSocketStatus = 'CONNECTING' | 'OPEN' | 'CLOSING' | 'CLOSED'

export interface UseWebSocketOptions {
  /**
   * Callback when the connection is established.
   */
  onConnected?: (ws: WebSocket) => void
  /**
   * Callback when the connection is closed.
   */
  onDisconnected?: (ws: WebSocket, event: CloseEvent) => void
  /**
   * Callback when an error occurs.
   */
  onError?: (ws: WebSocket, event: Event) => void
  /**
   * Callback when a message is received.
   */
  onMessage?: (ws: WebSocket, event: MessageEvent) => void
  /**
   * Whether to connect immediately on creation.
   * @default true
   */
  immediate?: boolean
  /**
   * Whether to auto-reconnect on disconnection.
   * Can be a boolean or an object with retries and delay.
   * @default false
   */
  autoReconnect?: boolean | { retries?: number, delay?: number }
  /**
   * Whether to send heartbeat messages to keep the connection alive.
   * Can be a boolean or an object with interval and message.
   * @default false
   */
  heartbeat?: boolean | { interval?: number, message?: string }
  /**
   * WebSocket sub-protocols.
   */
  protocols?: string | string[]
}

export interface UseWebSocketReturn {
  /** The latest message data received. */
  data: Ref<string | null>
  /** The current connection status. */
  status: Ref<WebSocketStatus>
  /** The raw WebSocket instance. */
  ws: Ref<WebSocket | null>
  /** Open the WebSocket connection. */
  open: () => void
  /** Close the WebSocket connection. */
  close: (code?: number, reason?: string) => void
  /** Send data through the WebSocket. */
  send: (data: string | ArrayBuffer | Blob) => void
}

/**
 * Reactive WebSocket connection.
 *
 * @param url - The WebSocket URL (can be a ref, getter, or raw string)
 * @param options - Configuration options
 * @returns Reactive WebSocket state and control methods
 *
 * @example
 * ```ts
 * const { data, status, send, close } = useWebSocket('ws://localhost:8080', {
 *   onConnected(ws) { console.log('Connected') },
 *   onMessage(ws, event) { console.log('Message:', event.data) },
 *   autoReconnect: { retries: 3, delay: 1000 },
 * })
 * ```
 */
export function useWebSocket(
  url: MaybeRefOrGetter<string>,
  options: UseWebSocketOptions = {},
): UseWebSocketReturn {
  const {
    onConnected,
    onDisconnected,
    onError,
    onMessage,
    immediate = true,
    autoReconnect = false,
    heartbeat = false,
    protocols,
  } = options

  const data = ref<string | null>(null) as Ref<string | null>
  const status = ref<WebSocketStatus>('CLOSED') as Ref<WebSocketStatus>
  const wsRef = ref<WebSocket | null>(null) as Ref<WebSocket | null>

  let retryCount = 0
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null
  let explicitlyClosed = false

  const heartbeatInterval = typeof heartbeat === 'object' ? (heartbeat.interval ?? 30000) : 30000
  const heartbeatMessage = typeof heartbeat === 'object' ? (heartbeat.message ?? 'ping') : 'ping'
  const maxRetries = typeof autoReconnect === 'object' ? (autoReconnect.retries ?? 3) : (autoReconnect ? Infinity : 0)
  const retryDelay = typeof autoReconnect === 'object' ? (autoReconnect.delay ?? 1000) : 1000

  function startHeartbeat(ws: WebSocket): void {
    stopHeartbeat()
    if (!heartbeat) return
    heartbeatTimer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(heartbeatMessage)
      }
    }, heartbeatInterval)
  }

  function stopHeartbeat(): void {
    if (heartbeatTimer !== null) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
  }

  function open(): void {
    if (typeof WebSocket === 'undefined') return

    close()
    explicitlyClosed = false
    retryCount = 0

    const resolvedUrl = toValue(url)
    status.value = 'CONNECTING'

    const ws = protocols
      ? new WebSocket(resolvedUrl, protocols)
      : new WebSocket(resolvedUrl)

    wsRef.value = ws

    ws.onopen = () => {
      status.value = 'OPEN'
      retryCount = 0
      startHeartbeat(ws)
      onConnected?.(ws)
    }

    ws.onclose = (event: CloseEvent) => {
      status.value = 'CLOSED'
      wsRef.value = null
      stopHeartbeat()
      onDisconnected?.(ws, event)

      if (!explicitlyClosed && autoReconnect && retryCount < maxRetries) {
        retryCount++
        retryTimer = setTimeout(() => {
          open()
        }, retryDelay)
      }
    }

    ws.onerror = (event: Event) => {
      onError?.(ws, event)
    }

    ws.onmessage = (event: MessageEvent) => {
      data.value = typeof event.data === 'string' ? event.data : String(event.data)
      onMessage?.(ws, event)
    }
  }

  function close(code?: number, reason?: string): void {
    explicitlyClosed = true
    stopHeartbeat()

    if (retryTimer !== null) {
      clearTimeout(retryTimer)
      retryTimer = null
    }

    const ws = wsRef.value
    if (ws) {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        status.value = 'CLOSING'
        ws.close(code, reason)
      }
      wsRef.value = null
    }
  }

  function send(sendData: string | ArrayBuffer | Blob): void {
    const ws = wsRef.value
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(sendData)
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
    status,
    ws: wsRef,
    open,
    close,
    send,
  }
}
