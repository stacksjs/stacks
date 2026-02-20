import { describe, expect, it, mock, beforeEach, afterEach } from 'bun:test'
import { ref, watch } from '@stacksjs/stx'
import { whenever } from '../src/whenever'
import { watchOnce } from '../src/watchOnce'
import { watchDebounced } from '../src/watchDebounced'
import { watchThrottled } from '../src/watchThrottled'
import { useWebSocket } from '../src/useWebSocket'
import { useEventSource } from '../src/useEventSource'
import { computedAsync } from '../src/computedAsync'
import { computedEager } from '../src/computedEager'

// ============================================================================
// Mock WebSocket
// ============================================================================

class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  static instances: MockWebSocket[] = []

  url: string
  protocols: string | string[] | undefined
  readyState: number = MockWebSocket.CONNECTING
  onopen: ((event: any) => void) | null = null
  onclose: ((event: any) => void) | null = null
  onmessage: ((event: any) => void) | null = null
  onerror: ((event: any) => void) | null = null
  sentMessages: (string | ArrayBuffer | Blob)[] = []
  closedWith: { code?: number, reason?: string } | null = null

  constructor(url: string, protocols?: string | string[]) {
    this.url = url
    this.protocols = protocols
    MockWebSocket.instances.push(this)
  }

  send(data: string | ArrayBuffer | Blob): void {
    this.sentMessages.push(data)
  }

  close(code?: number, reason?: string): void {
    this.closedWith = { code, reason }
    this.readyState = MockWebSocket.CLOSING
    // Simulate async close
    setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED
      if (this.onclose) {
        this.onclose({ code: code ?? 1000, reason: reason ?? '', wasClean: true })
      }
    }, 0)
  }

  // Test helpers
  simulateOpen(): void {
    this.readyState = MockWebSocket.OPEN
    if (this.onopen) {
      this.onopen({ type: 'open' })
    }
  }

  simulateMessage(data: string): void {
    if (this.onmessage) {
      this.onmessage({ data, type: 'message' })
    }
  }

  simulateError(eventData?: any): void {
    if (this.onerror) {
      this.onerror(eventData ?? { type: 'error' })
    }
  }

  simulateClose(code: number = 1000, reason: string = ''): void {
    this.readyState = MockWebSocket.CLOSED
    if (this.onclose) {
      this.onclose({ code, reason, wasClean: code === 1000 })
    }
  }

  static reset(): void {
    MockWebSocket.instances = []
  }

  static get lastInstance(): MockWebSocket | undefined {
    return MockWebSocket.instances[MockWebSocket.instances.length - 1]
  }
}

// ============================================================================
// Mock EventSource
// ============================================================================

class MockEventSource {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSED = 2

  static instances: MockEventSource[] = []

  url: string
  withCredentials: boolean
  readyState: number = MockEventSource.CONNECTING
  onopen: ((event: any) => void) | null = null
  onmessage: ((event: any) => void) | null = null
  onerror: ((event: any) => void) | null = null

  private eventListeners: Map<string, Array<(e: any) => void>> = new Map()

  constructor(url: string, options?: { withCredentials?: boolean }) {
    this.url = url
    this.withCredentials = options?.withCredentials ?? false
    MockEventSource.instances.push(this)
  }

  addEventListener(event: string, handler: (e: any) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, [])
    }
    this.eventListeners.get(event)!.push(handler)
  }

  removeEventListener(event: string, handler: (e: any) => void): void {
    const handlers = this.eventListeners.get(event)
    if (handlers) {
      const idx = handlers.indexOf(handler)
      if (idx !== -1) {
        handlers.splice(idx, 1)
      }
    }
  }

  close(): void {
    this.readyState = MockEventSource.CLOSED
  }

  // Test helpers
  simulateOpen(): void {
    this.readyState = MockEventSource.OPEN
    if (this.onopen) {
      this.onopen({ type: 'open' })
    }
  }

  simulateMessage(data: string, eventType: string = 'message'): void {
    const event = { data, type: eventType }
    const handlers = this.eventListeners.get(eventType)
    if (handlers) {
      for (const handler of handlers) {
        handler(event)
      }
    }
  }

  simulateError(): void {
    const event = { type: 'error' }
    if (this.onerror) {
      this.onerror(event)
    }
  }

  static reset(): void {
    MockEventSource.instances = []
  }

  static get lastInstance(): MockEventSource | undefined {
    return MockEventSource.instances[MockEventSource.instances.length - 1]
  }
}

// ============================================================================
// whenever
// ============================================================================

describe('whenever', () => {
  it('should call callback when value becomes truthy', () => {
    const source = ref(false)
    const callback = mock(() => {})

    whenever(source, callback)

    source.value = true
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(true)
  })

  it('should not call callback when value becomes falsy', () => {
    const source = ref(true)
    const callback = mock(() => {})

    whenever(source, callback)

    source.value = false
    expect(callback).not.toHaveBeenCalled()
  })

  it('should call callback on each truthy transition', () => {
    const source = ref<boolean | number>(false)
    const callback = mock(() => {})

    whenever(source, callback)

    source.value = true
    source.value = false
    source.value = 1

    expect(callback).toHaveBeenCalledTimes(2)
  })

  it('should call callback with truthy non-boolean values', () => {
    const source = ref<string | null>(null)
    const callback = mock(() => {})

    whenever(source, callback)

    source.value = 'hello'
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith('hello')
  })

  it('should not call callback for falsy values like 0, empty string, null', () => {
    const source = ref<any>('initial')
    const callback = mock(() => {})

    whenever(source, callback)

    source.value = 0
    source.value = ''
    source.value = null
    source.value = undefined

    expect(callback).not.toHaveBeenCalled()
  })

  it('should return an unsubscribe function that stops watching', () => {
    const source = ref(false)
    const callback = mock(() => {})

    const stop = whenever(source, callback)

    stop()

    source.value = true
    expect(callback).not.toHaveBeenCalled()
  })

  it('should handle numeric truthy values', () => {
    const source = ref(0)
    const callback = mock(() => {})

    whenever(source, callback)

    source.value = 42
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(42)
  })

  it('should handle repeated truthy values', () => {
    const source = ref<string>('')
    const callback = mock(() => {})

    whenever(source, callback)

    source.value = 'a'
    source.value = 'b'
    source.value = 'c'

    expect(callback).toHaveBeenCalledTimes(3)
  })
})

// ============================================================================
// watchOnce
// ============================================================================

describe('watchOnce', () => {
  it('should call callback on first change', () => {
    const source = ref(0)
    const callback = mock(() => {})

    watchOnce(source, callback)

    source.value = 1
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(1)
  })

  it('should not call callback on subsequent changes', () => {
    const source = ref(0)
    const callback = mock(() => {})

    watchOnce(source, callback)

    source.value = 1
    source.value = 2
    source.value = 3

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(1)
  })

  it('should allow manual stop before first trigger', () => {
    const source = ref(0)
    const callback = mock(() => {})

    const stop = watchOnce(source, callback)
    stop()

    source.value = 1
    expect(callback).not.toHaveBeenCalled()
  })

  it('should handle manual stop after first trigger (no-op)', () => {
    const source = ref(0)
    const callback = mock(() => {})

    const stop = watchOnce(source, callback)

    source.value = 1
    expect(callback).toHaveBeenCalledTimes(1)

    // Calling stop again should be safe
    stop()
    source.value = 2
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('should work with string refs', () => {
    const source = ref('hello')
    const callback = mock(() => {})

    watchOnce(source, callback)

    source.value = 'world'
    expect(callback).toHaveBeenCalledWith('world')

    source.value = 'again'
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('should work with object refs', () => {
    const source = ref<{ count: number }>({ count: 0 })
    const callback = mock(() => {})

    watchOnce(source, callback)

    const newObj = { count: 1 }
    source.value = newObj
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(newObj)
  })

  it('should work with boolean refs', () => {
    const source = ref(false)
    const callback = mock(() => {})

    watchOnce(source, callback)

    source.value = true
    expect(callback).toHaveBeenCalledWith(true)

    source.value = false
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('should fire callback even for falsy values (since any change triggers it)', () => {
    const source = ref<number | null>(42)
    const callback = mock(() => {})

    watchOnce(source, callback)

    source.value = 0
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(0)
  })
})

// ============================================================================
// watchDebounced
// ============================================================================

describe('watchDebounced', () => {
  it('should debounce callback invocations', async () => {
    const source = ref(0)
    const callback = mock(() => {})

    watchDebounced(source, callback, { debounce: 100 })

    source.value = 1
    source.value = 2
    source.value = 3

    // Callback should not have been called yet
    expect(callback).not.toHaveBeenCalled()

    await Bun.sleep(150)

    // Should have been called once with the latest value
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(3)
  })

  it('should use default debounce of 200ms', async () => {
    const source = ref(0)
    const callback = mock(() => {})

    watchDebounced(source, callback)

    source.value = 1

    await Bun.sleep(100)
    expect(callback).not.toHaveBeenCalled()

    await Bun.sleep(150)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('should reset debounce timer on rapid changes', async () => {
    const source = ref(0)
    const callback = mock(() => {})

    watchDebounced(source, callback, { debounce: 100 })

    source.value = 1
    await Bun.sleep(50)

    source.value = 2
    await Bun.sleep(50)

    source.value = 3
    await Bun.sleep(50)

    // Not yet, timer was reset each time
    expect(callback).not.toHaveBeenCalled()

    await Bun.sleep(100)
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(3)
  })

  it('should allow separate debounced calls after silence period', async () => {
    const source = ref(0)
    const callback = mock(() => {})

    watchDebounced(source, callback, { debounce: 50 })

    source.value = 1
    await Bun.sleep(80)
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(1)

    source.value = 2
    await Bun.sleep(80)
    expect(callback).toHaveBeenCalledTimes(2)
    expect(callback).toHaveBeenCalledWith(2)
  })

  it('should stop watching and clear timer on stop()', async () => {
    const source = ref(0)
    const callback = mock(() => {})

    const stop = watchDebounced(source, callback, { debounce: 100 })

    source.value = 1
    stop()

    await Bun.sleep(150)
    expect(callback).not.toHaveBeenCalled()

    // Changes after stop should also not trigger
    source.value = 2
    await Bun.sleep(150)
    expect(callback).not.toHaveBeenCalled()
  })

  it('should handle zero debounce time', async () => {
    const source = ref(0)
    const callback = mock(() => {})

    watchDebounced(source, callback, { debounce: 0 })

    source.value = 1
    await Bun.sleep(10)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(1)
  })

  it('should work with string values', async () => {
    const source = ref('')
    const callback = mock(() => {})

    watchDebounced(source, callback, { debounce: 50 })

    source.value = 'h'
    source.value = 'he'
    source.value = 'hel'
    source.value = 'hell'
    source.value = 'hello'

    await Bun.sleep(80)
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith('hello')
  })

  it('should stop cleanly even if no change was made', () => {
    const source = ref(0)
    const callback = mock(() => {})

    const stop = watchDebounced(source, callback, { debounce: 100 })

    // Stop without any change - should not throw
    stop()
  })
})

// ============================================================================
// watchThrottled
// ============================================================================

describe('watchThrottled', () => {
  it('should call callback immediately on first change', () => {
    const source = ref(0)
    const callback = mock(() => {})

    watchThrottled(source, callback, { throttle: 200 })

    source.value = 1
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(1)
  })

  it('should throttle subsequent rapid calls', async () => {
    const source = ref(0)
    const callback = mock(() => {})

    watchThrottled(source, callback, { throttle: 100 })

    source.value = 1 // immediate
    source.value = 2 // throttled
    source.value = 3 // throttled (overwrites 2)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(1)

    await Bun.sleep(150)

    // trailing call with latest value
    expect(callback).toHaveBeenCalledTimes(2)
    expect(callback).toHaveBeenCalledWith(3)
  })

  it('should use default throttle of 200ms', async () => {
    const source = ref(0)
    const callback = mock(() => {})

    watchThrottled(source, callback)

    source.value = 1 // immediate
    source.value = 2 // throttled

    expect(callback).toHaveBeenCalledTimes(1)

    await Bun.sleep(250)
    expect(callback).toHaveBeenCalledTimes(2)
  })

  it('should allow new immediate call after throttle window', async () => {
    const source = ref(0)
    const callback = mock(() => {})

    watchThrottled(source, callback, { throttle: 50 })

    source.value = 1
    expect(callback).toHaveBeenCalledTimes(1)

    await Bun.sleep(80)

    source.value = 2
    expect(callback).toHaveBeenCalledTimes(2)
    expect(callback).toHaveBeenCalledWith(2)
  })

  it('should stop watching and clear timer on stop()', async () => {
    const source = ref(0)
    const callback = mock(() => {})

    const stop = watchThrottled(source, callback, { throttle: 100 })

    source.value = 1 // immediate call
    expect(callback).toHaveBeenCalledTimes(1)

    source.value = 2 // would be trailing
    stop()

    await Bun.sleep(150)
    // trailing call should be canceled
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('should handle single change without trailing', async () => {
    const source = ref(0)
    const callback = mock(() => {})

    watchThrottled(source, callback, { throttle: 100 })

    source.value = 1

    await Bun.sleep(150)
    // Only one call (the immediate), no trailing needed
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('should pass the latest value on trailing call', async () => {
    const source = ref(0)
    const values: number[] = []

    watchThrottled(source, (val) => {
      values.push(val)
    }, { throttle: 100 })

    source.value = 1
    source.value = 2
    source.value = 3
    source.value = 4
    source.value = 5

    await Bun.sleep(150)

    expect(values[0]).toBe(1)
    expect(values[1]).toBe(5)
    expect(values.length).toBe(2)
  })

  it('should stop cleanly even when no changes made', () => {
    const source = ref(0)
    const callback = mock(() => {})

    const stop = watchThrottled(source, callback, { throttle: 100 })
    stop() // should not throw
  })
})

// ============================================================================
// useWebSocket
// ============================================================================

describe('useWebSocket', () => {
  let originalWebSocket: any

  beforeEach(() => {
    originalWebSocket = (globalThis as any).WebSocket
    ;(globalThis as any).WebSocket = MockWebSocket
    MockWebSocket.reset()
  })

  afterEach(() => {
    if (originalWebSocket !== undefined) {
      ;(globalThis as any).WebSocket = originalWebSocket
    }
    else {
      delete (globalThis as any).WebSocket
    }
  })

  it('should connect immediately by default', () => {
    const { status } = useWebSocket('ws://localhost:8080')

    expect(MockWebSocket.instances.length).toBe(1)
    expect(status.value).toBe('CONNECTING')
  })

  it('should not connect immediately when immediate is false', () => {
    const { status } = useWebSocket('ws://localhost:8080', { immediate: false })

    expect(MockWebSocket.instances.length).toBe(0)
    expect(status.value).toBe('CLOSED')
  })

  it('should update status to OPEN on connection', () => {
    const { status } = useWebSocket('ws://localhost:8080')

    const ws = MockWebSocket.lastInstance!
    ws.simulateOpen()

    expect(status.value).toBe('OPEN')
  })

  it('should call onConnected callback when connected', () => {
    const onConnected = mock(() => {})
    useWebSocket('ws://localhost:8080', { onConnected })

    const ws = MockWebSocket.lastInstance!
    ws.simulateOpen()

    expect(onConnected).toHaveBeenCalledTimes(1)
  })

  it('should receive messages and update data ref', () => {
    const { data } = useWebSocket('ws://localhost:8080')

    const ws = MockWebSocket.lastInstance!
    ws.simulateOpen()
    ws.simulateMessage('hello world')

    expect(data.value).toBe('hello world')
  })

  it('should call onMessage callback', () => {
    const onMessage = mock(() => {})
    useWebSocket('ws://localhost:8080', { onMessage })

    const ws = MockWebSocket.lastInstance!
    ws.simulateOpen()
    ws.simulateMessage('test data')

    expect(onMessage).toHaveBeenCalledTimes(1)
  })

  it('should send data through the WebSocket', () => {
    const { send } = useWebSocket('ws://localhost:8080')

    const ws = MockWebSocket.lastInstance!
    ws.simulateOpen()

    send('hello server')
    expect(ws.sentMessages).toEqual(['hello server'])
  })

  it('should not send when WebSocket is not open', () => {
    const { send } = useWebSocket('ws://localhost:8080')

    // readyState is still CONNECTING
    send('hello server')
    const ws = MockWebSocket.lastInstance!
    expect(ws.sentMessages).toEqual([])
  })

  it('should close the connection', () => {
    const { close } = useWebSocket('ws://localhost:8080')

    const ws = MockWebSocket.lastInstance!
    ws.simulateOpen()

    close(1000, 'normal closure')
    expect(ws.closedWith).toEqual({ code: 1000, reason: 'normal closure' })
  })

  it('should call onError callback on error', () => {
    const onError = mock(() => {})
    useWebSocket('ws://localhost:8080', { onError })

    const ws = MockWebSocket.lastInstance!
    ws.simulateError({ type: 'error' })

    expect(onError).toHaveBeenCalledTimes(1)
  })

  it('should call onDisconnected callback on close', () => {
    const onDisconnected = mock(() => {})
    useWebSocket('ws://localhost:8080', { onDisconnected })

    const ws = MockWebSocket.lastInstance!
    ws.simulateOpen()
    ws.simulateClose(1000, 'normal')

    expect(onDisconnected).toHaveBeenCalledTimes(1)
  })

  it('should update status to CLOSED on disconnection', () => {
    const { status } = useWebSocket('ws://localhost:8080')

    const ws = MockWebSocket.lastInstance!
    ws.simulateOpen()
    ws.simulateClose()

    expect(status.value).toBe('CLOSED')
  })

  it('should auto-reconnect when configured', async () => {
    const { status } = useWebSocket('ws://localhost:8080', {
      autoReconnect: { retries: 3, delay: 50 },
    })

    const ws1 = MockWebSocket.lastInstance!
    ws1.simulateOpen()
    ws1.simulateClose(1006, 'abnormal')

    expect(MockWebSocket.instances.length).toBe(1)

    await Bun.sleep(80)

    // A new connection attempt should have been made
    expect(MockWebSocket.instances.length).toBe(2)
  })

  it('should not auto-reconnect after explicit close', async () => {
    const { close } = useWebSocket('ws://localhost:8080', {
      autoReconnect: { retries: 3, delay: 50 },
    })

    const ws = MockWebSocket.lastInstance!
    ws.simulateOpen()

    close()

    await Bun.sleep(80)

    // Should still be only 1 instance since we explicitly closed
    expect(MockWebSocket.instances.length).toBe(1)
  })

  it('should send heartbeat messages when configured', async () => {
    useWebSocket('ws://localhost:8080', {
      heartbeat: { interval: 50, message: 'heartbeat' },
    })

    const ws = MockWebSocket.lastInstance!
    ws.simulateOpen()

    await Bun.sleep(120)

    // Should have sent at least one heartbeat
    expect(ws.sentMessages.length).toBeGreaterThanOrEqual(1)
    expect(ws.sentMessages[0]).toBe('heartbeat')
  })

  it('should open connection manually after immediate=false', () => {
    const { open, status } = useWebSocket('ws://localhost:8080', { immediate: false })

    expect(MockWebSocket.instances.length).toBe(0)

    open()

    expect(MockWebSocket.instances.length).toBe(1)
    expect(status.value).toBe('CONNECTING')
  })

  it('should pass protocols to WebSocket constructor', () => {
    useWebSocket('ws://localhost:8080', {
      protocols: ['graphql-ws', 'graphql-transport-ws'],
    })

    const ws = MockWebSocket.lastInstance!
    expect(ws.protocols).toEqual(['graphql-ws', 'graphql-transport-ws'])
  })
})

// ============================================================================
// useEventSource
// ============================================================================

describe('useEventSource', () => {
  let originalEventSource: any

  beforeEach(() => {
    originalEventSource = (globalThis as any).EventSource
    ;(globalThis as any).EventSource = MockEventSource
    MockEventSource.reset()
  })

  afterEach(() => {
    if (originalEventSource !== undefined) {
      ;(globalThis as any).EventSource = originalEventSource
    }
    else {
      delete (globalThis as any).EventSource
    }
  })

  it('should connect immediately by default', () => {
    const { status } = useEventSource('/api/events')

    expect(MockEventSource.instances.length).toBe(1)
    expect(status.value).toBe('CONNECTING')
  })

  it('should not connect when immediate is false', () => {
    const { status } = useEventSource('/api/events', [], { immediate: false })

    expect(MockEventSource.instances.length).toBe(0)
    expect(status.value).toBe('CLOSED')
  })

  it('should update status to OPEN on connection', () => {
    const { status } = useEventSource('/api/events')

    const es = MockEventSource.lastInstance!
    es.simulateOpen()

    expect(status.value).toBe('OPEN')
  })

  it('should receive default message events', () => {
    const { data, event } = useEventSource('/api/events')

    const es = MockEventSource.lastInstance!
    es.simulateOpen()
    es.simulateMessage('hello data')

    expect(data.value).toBe('hello data')
    expect(event.value).toBe('message')
  })

  it('should receive custom named events', () => {
    const { data, event } = useEventSource('/api/events', ['update', 'delete'])

    const es = MockEventSource.lastInstance!
    es.simulateOpen()
    es.simulateMessage('item updated', 'update')

    expect(data.value).toBe('item updated')
    expect(event.value).toBe('update')
  })

  it('should handle multiple custom event types', () => {
    const { data, event } = useEventSource('/api/events', ['create', 'update', 'delete'])

    const es = MockEventSource.lastInstance!
    es.simulateOpen()

    es.simulateMessage('created item', 'create')
    expect(data.value).toBe('created item')
    expect(event.value).toBe('create')

    es.simulateMessage('deleted item', 'delete')
    expect(data.value).toBe('deleted item')
    expect(event.value).toBe('delete')
  })

  it('should handle error events', () => {
    const { error, status } = useEventSource('/api/events')

    const es = MockEventSource.lastInstance!
    es.readyState = MockEventSource.CLOSED
    es.simulateError()

    expect(error.value).not.toBeNull()
    expect(status.value).toBe('CLOSED')
  })

  it('should close the connection', () => {
    const { close, status } = useEventSource('/api/events')

    const es = MockEventSource.lastInstance!
    es.simulateOpen()

    close()
    expect(status.value).toBe('CLOSED')
    expect(es.readyState).toBe(MockEventSource.CLOSED)
  })

  it('should reopen after closing', () => {
    const { close, open, status } = useEventSource('/api/events')

    const es1 = MockEventSource.lastInstance!
    es1.simulateOpen()

    close()
    expect(status.value).toBe('CLOSED')

    open()
    expect(MockEventSource.instances.length).toBe(2)
    expect(status.value).toBe('CONNECTING')
  })

  it('should pass withCredentials option', () => {
    useEventSource('/api/events', [], { withCredentials: true })

    const es = MockEventSource.lastInstance!
    expect(es.withCredentials).toBe(true)
  })

  it('should expose the raw eventSource ref', () => {
    const { eventSource } = useEventSource('/api/events')

    expect(eventSource.value).not.toBeNull()
    expect(eventSource.value).toBe(MockEventSource.lastInstance)
  })

  it('should set eventSource to null after close', () => {
    const { eventSource, close } = useEventSource('/api/events')

    expect(eventSource.value).not.toBeNull()

    close()
    expect(eventSource.value).toBeNull()
  })

  it('should clear error on successful reconnection', () => {
    const { error, close, open } = useEventSource('/api/events')

    const es1 = MockEventSource.lastInstance!
    es1.readyState = MockEventSource.CLOSED
    es1.simulateError()
    expect(error.value).not.toBeNull()

    close()
    open()

    const es2 = MockEventSource.lastInstance!
    es2.simulateOpen()
    expect(error.value).toBeNull()
  })
})

// ============================================================================
// computedAsync
// ============================================================================

describe('computedAsync', () => {
  it('should return initial state immediately', () => {
    const result = computedAsync(
      async () => 'loaded',
      'loading',
    )

    expect(result.value).toBe('loading')
  })

  it('should resolve to the async value', async () => {
    const result = computedAsync(
      async () => {
        await Bun.sleep(10)
        return 'resolved'
      },
      'initial',
    )

    expect(result.value).toBe('initial')
    await Bun.sleep(30)
    expect(result.value).toBe('resolved')
  })

  it('should re-evaluate when a dependency changes', async () => {
    const userId = ref(1)
    const result = computedAsync(
      async () => {
        const id = userId.value
        await Bun.sleep(10)
        return `user-${id}`
      },
      'loading',
      [userId],
    )

    await Bun.sleep(30)
    expect(result.value).toBe('user-1')

    userId.value = 2
    await Bun.sleep(30)
    expect(result.value).toBe('user-2')
  })

  it('should handle errors silently and keep previous value', async () => {
    let shouldFail = false
    const trigger = ref(0)

    const result = computedAsync(
      async () => {
        if (shouldFail) throw new Error('fail')
        return `value-${trigger.value}`
      },
      'initial',
      [trigger],
    )

    await Bun.sleep(30)
    expect(result.value).toBe('value-0')

    shouldFail = true
    trigger.value = 1
    await Bun.sleep(30)

    // Value should remain from before the error
    expect(result.value).toBe('value-0')
  })

  it('should cancel stale evaluations (latest wins)', async () => {
    const dep = ref(0)
    const result = computedAsync(
      async () => {
        const val = dep.value
        await Bun.sleep(val === 1 ? 100 : 10)
        return `result-${val}`
      },
      'initial',
      [dep],
    )

    await Bun.sleep(30)
    expect(result.value).toBe('result-0')

    // Trigger two rapid changes
    dep.value = 1 // slow (100ms)
    await Bun.sleep(5)
    dep.value = 2 // fast (10ms)

    await Bun.sleep(150)

    // The slow evaluation for dep=1 should be discarded
    expect(result.value).toBe('result-2')
  })

  it('should work without deps (evaluates once on init)', async () => {
    const result = computedAsync(
      async () => {
        await Bun.sleep(10)
        return 42
      },
      0,
    )

    expect(result.value).toBe(0)
    await Bun.sleep(30)
    expect(result.value).toBe(42)
  })

  it('should handle multiple deps', async () => {
    const a = ref(1)
    const b = ref(2)

    const result = computedAsync(
      async () => {
        return a.value + b.value
      },
      0,
      [a, b],
    )

    await Bun.sleep(20)
    expect(result.value).toBe(3)

    a.value = 10
    await Bun.sleep(20)
    expect(result.value).toBe(12)

    b.value = 20
    await Bun.sleep(20)
    expect(result.value).toBe(30)
  })

  it('should handle synchronous resolving async function', async () => {
    const result = computedAsync(
      async () => 'immediate',
      'pending',
    )

    await Bun.sleep(10)
    expect(result.value).toBe('immediate')
  })
})

// ============================================================================
// computedEager
// ============================================================================

describe('computedEager', () => {
  it('should evaluate immediately', () => {
    const result = computedEager(() => 42)
    expect(result.value).toBe(42)
  })

  it('should re-evaluate when deps change', () => {
    const count = ref(1)
    const doubled = computedEager(() => count.value * 2, [count])

    expect(doubled.value).toBe(2)

    count.value = 5
    expect(doubled.value).toBe(10)
  })

  it('should handle multiple deps', () => {
    const a = ref(2)
    const b = ref(3)
    const sum = computedEager(() => a.value + b.value, [a, b])

    expect(sum.value).toBe(5)

    a.value = 10
    expect(sum.value).toBe(13)

    b.value = 20
    expect(sum.value).toBe(30)
  })

  it('should work with string computations', () => {
    const first = ref('hello')
    const last = ref('world')
    const full = computedEager(() => `${first.value} ${last.value}`, [first, last])

    expect(full.value).toBe('hello world')

    first.value = 'goodbye'
    expect(full.value).toBe('goodbye world')
  })

  it('should work with array computations', () => {
    const items = ref([1, 2, 3])
    const total = computedEager(() => items.value.reduce((a, b) => a + b, 0), [items])

    expect(total.value).toBe(6)

    items.value = [10, 20, 30]
    expect(total.value).toBe(60)
  })

  it('should work without deps (static computation)', () => {
    const result = computedEager(() => Math.PI * 2)
    expect(result.value).toBeCloseTo(6.2831853, 5)
  })

  it('should handle boolean computations', () => {
    const count = ref(0)
    const isPositive = computedEager(() => count.value > 0, [count])

    expect(isPositive.value).toBe(false)

    count.value = 5
    expect(isPositive.value).toBe(true)

    count.value = -1
    expect(isPositive.value).toBe(false)
  })

  it('should handle object return values', () => {
    const x = ref(1)
    const y = ref(2)
    const point = computedEager(() => ({ x: x.value, y: y.value }), [x, y])

    expect(point.value).toEqual({ x: 1, y: 2 })

    x.value = 10
    expect(point.value).toEqual({ x: 10, y: 2 })
  })
})
