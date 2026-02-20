import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'

// ---------------------------------------------------------------------------
//  Rely on the preload for @stacksjs/stx mock (functional reactive ref).
//  Only dynamic imports used so the mock is applied first.
// ---------------------------------------------------------------------------

// Now import the composables - must be dynamic to use the mocked module
const { useIntersectionObserver } = await import('../src/useIntersectionObserver')
const { useResizeObserver } = await import('../src/useResizeObserver')
const { useMutationObserver } = await import('../src/useMutationObserver')
const { useElementSize } = await import('../src/useElementSize')
const { useElementBounding } = await import('../src/useElementBounding')
const { useElementVisibility } = await import('../src/useElementVisibility')
const { useMouse } = await import('../src/useMouse')
const { useGeolocation } = await import('../src/useGeolocation')
const { useDeviceMotion } = await import('../src/useDeviceMotion')
const { useDeviceOrientation } = await import('../src/useDeviceOrientation')
const { useBattery } = await import('../src/useBattery')
const { useIdle } = await import('../src/useIdle')
const { usePageLeave } = await import('../src/usePageLeave')
const { useDraggable } = await import('../src/useDraggable')
const { useDropZone } = await import('../src/useDropZone')

// ---------------------------------------------------------------------------
//  Utility: create a mock HTMLElement with addEventListener/removeEventListener
// ---------------------------------------------------------------------------
function createMockElement(): HTMLElement & { __listeners: Record<string, Set<EventListener>> } {
  const listeners: Record<string, Set<EventListener>> = {}
  return {
    addEventListener: (type: string, listener: EventListenerOrEventListenerObject, _opts?: any) => {
      if (!listeners[type]) listeners[type] = new Set()
      listeners[type].add(listener as EventListener)
    },
    removeEventListener: (type: string, listener: EventListenerOrEventListenerObject, _opts?: any) => {
      listeners[type]?.delete(listener as EventListener)
    },
    dispatchEvent: (event: Event): boolean => {
      const handlers = listeners[event.type]
      if (handlers) {
        for (const h of handlers) h(event)
      }
      return true
    },
    getBoundingClientRect: () => ({
      x: 10,
      y: 20,
      top: 20,
      right: 110,
      bottom: 120,
      left: 10,
      width: 100,
      height: 100,
      toJSON: () => {},
    }),
    style: {},
    __listeners: listeners,
  } as unknown as HTMLElement & { __listeners: Record<string, Set<EventListener>> }
}

// ---------------------------------------------------------------------------
//  Save and restore globals between tests
// ---------------------------------------------------------------------------
let savedWindow: any
let savedDocument: any
let savedNavigator: any

function saveGlobals() {
  savedWindow = (globalThis as any).window
  savedDocument = (globalThis as any).document
  savedNavigator = (globalThis as any).navigator
}

function restoreGlobals() {
  if (savedWindow !== undefined) (globalThis as any).window = savedWindow
  else delete (globalThis as any).window
  if (savedDocument !== undefined) (globalThis as any).document = savedDocument
  else delete (globalThis as any).document
  if (savedNavigator !== undefined) (globalThis as any).navigator = savedNavigator
  else delete (globalThis as any).navigator
}

// ---------------------------------------------------------------------------
//  Mock browser environment helpers
// ---------------------------------------------------------------------------
interface MockWindow {
  addEventListener: (type: string, listener: EventListenerOrEventListenerObject, opts?: any) => void
  removeEventListener: (type: string, listener: EventListenerOrEventListenerObject, opts?: any) => void
  dispatchEvent: (event: Event) => boolean
  innerWidth: number
  innerHeight: number
  IntersectionObserver: any
  ResizeObserver: any
  MutationObserver: any
  DeviceMotionEvent: any
  DeviceOrientationEvent: any
  __listeners: Record<string, Set<EventListener>>
}

function setupWindowMock(): MockWindow {
  const listeners: Record<string, Set<EventListener>> = {}
  const win: MockWindow = {
    addEventListener: (type: string, listener: EventListenerOrEventListenerObject, _opts?: any) => {
      if (!listeners[type]) listeners[type] = new Set()
      listeners[type].add(listener as EventListener)
    },
    removeEventListener: (type: string, listener: EventListenerOrEventListenerObject, _opts?: any) => {
      listeners[type]?.delete(listener as EventListener)
    },
    dispatchEvent: (event: Event): boolean => {
      const handlers = listeners[event.type]
      if (handlers) {
        for (const h of handlers) h(event)
      }
      return true
    },
    innerWidth: 1024,
    innerHeight: 768,
    IntersectionObserver: undefined as any,
    ResizeObserver: undefined as any,
    MutationObserver: undefined as any,
    DeviceMotionEvent: undefined as any,
    DeviceOrientationEvent: undefined as any,
    __listeners: listeners,
  }
  ;(globalThis as any).window = win
  return win
}

function setupDocumentMock() {
  const docListeners: Record<string, Set<EventListener>> = {}
  const docEl = {
    addEventListener: (type: string, listener: EventListenerOrEventListenerObject, _opts?: any) => {
      if (!docListeners[type]) docListeners[type] = new Set()
      docListeners[type].add(listener as EventListener)
    },
    removeEventListener: (type: string, listener: EventListenerOrEventListenerObject, _opts?: any) => {
      docListeners[type]?.delete(listener as EventListener)
    },
    dispatchEvent: (event: Event): boolean => {
      const handlers = docListeners[event.type]
      if (handlers) {
        for (const h of handlers) h(event)
      }
      return true
    },
    __listeners: docListeners,
  }
  ;(globalThis as any).document = {
    documentElement: docEl,
    addEventListener: docEl.addEventListener,
    removeEventListener: docEl.removeEventListener,
    dispatchEvent: docEl.dispatchEvent,
  }
  return docEl
}

// ---------------------------------------------------------------------------
//  Mock Observers
// ---------------------------------------------------------------------------
class MockIntersectionObserver {
  callback: IntersectionObserverCallback
  targets: Element[] = []
  static instances: MockIntersectionObserver[] = []

  constructor(callback: IntersectionObserverCallback, _options?: IntersectionObserverInit) {
    this.callback = callback
    MockIntersectionObserver.instances.push(this)
  }

  observe(target: Element) { this.targets.push(target) }
  unobserve(target: Element) { this.targets = this.targets.filter(t => t !== target) }
  disconnect() { this.targets = [] }

  trigger(entries: Partial<IntersectionObserverEntry>[]) {
    this.callback(entries as IntersectionObserverEntry[], this as any)
  }
}

class MockResizeObserver {
  callback: ResizeObserverCallback
  targets: Element[] = []
  static instances: MockResizeObserver[] = []

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
    MockResizeObserver.instances.push(this)
  }

  observe(target: Element, _options?: ResizeObserverOptions) { this.targets.push(target) }
  unobserve(target: Element) { this.targets = this.targets.filter(t => t !== target) }
  disconnect() { this.targets = [] }

  trigger(entries: Partial<ResizeObserverEntry>[]) {
    this.callback(entries as ResizeObserverEntry[], this as any)
  }
}

class MockMutationObserver {
  callback: MutationCallback
  targets: Node[] = []
  static instances: MockMutationObserver[] = []

  constructor(callback: MutationCallback) {
    this.callback = callback
    MockMutationObserver.instances.push(this)
  }

  observe(target: Node, _options?: MutationObserverInit) { this.targets.push(target) }
  disconnect() { this.targets = [] }
  takeRecords(): MutationRecord[] { return [] }

  trigger(records: Partial<MutationRecord>[]) {
    this.callback(records as MutationRecord[], this as any)
  }
}

function installObserverMocks() {
  MockIntersectionObserver.instances = []
  MockResizeObserver.instances = []
  MockMutationObserver.instances = []
  ;(globalThis as any).IntersectionObserver = MockIntersectionObserver
  ;(globalThis as any).ResizeObserver = MockResizeObserver
  ;(globalThis as any).MutationObserver = MockMutationObserver
  if ((globalThis as any).window) {
    ;(globalThis as any).window.IntersectionObserver = MockIntersectionObserver
    ;(globalThis as any).window.ResizeObserver = MockResizeObserver
    ;(globalThis as any).window.MutationObserver = MockMutationObserver
  }
}

// ==========================================================================
//  TESTS
// ==========================================================================

describe('useIntersectionObserver', () => {
  beforeEach(() => {
    saveGlobals()
    setupWindowMock()
    installObserverMocks()
  })
  afterEach(() => restoreGlobals())

  it('should return isSupported as true when IntersectionObserver is available', () => {
    const el = createMockElement()
    const { isSupported } = useIntersectionObserver(el, () => {})
    expect(isSupported.value).toBe(true)
  })

  it('should observe the target element', () => {
    const el = createMockElement()
    useIntersectionObserver(el, () => {})
    const instance = MockIntersectionObserver.instances[MockIntersectionObserver.instances.length - 1]
    expect(instance).toBeDefined()
    expect(instance.targets).toContain(el)
  })

  it('should call the callback when intersection changes', () => {
    const el = createMockElement()
    const cb = mock(() => {})
    useIntersectionObserver(el, cb)
    const instance = MockIntersectionObserver.instances[MockIntersectionObserver.instances.length - 1]
    instance.trigger([{ isIntersecting: true, target: el }])
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('should disconnect observer when stop is called', () => {
    const el = createMockElement()
    const { stop } = useIntersectionObserver(el, () => {})
    const instance = MockIntersectionObserver.instances[MockIntersectionObserver.instances.length - 1]
    stop()
    expect(instance.targets.length).toBe(0)
  })

  it('should not throw when target is null', () => {
    expect(() => useIntersectionObserver(null, () => {})).not.toThrow()
  })

  it('should pass options to IntersectionObserver', () => {
    const el = createMockElement()
    useIntersectionObserver(el, () => {}, { threshold: 0.5 })
    expect(MockIntersectionObserver.instances.length).toBeGreaterThan(0)
  })

  it('should be SSR-safe when window is undefined', () => {
    delete (globalThis as any).window
    expect(() => useIntersectionObserver(null, () => {})).not.toThrow()
  })

  it('should handle multiple trigger calls', () => {
    const el = createMockElement()
    const cb = mock(() => {})
    useIntersectionObserver(el, cb)
    const instance = MockIntersectionObserver.instances[MockIntersectionObserver.instances.length - 1]
    instance.trigger([{ isIntersecting: true, target: el }])
    instance.trigger([{ isIntersecting: false, target: el }])
    instance.trigger([{ isIntersecting: true, target: el }])
    expect(cb).toHaveBeenCalledTimes(3)
  })
})

describe('useResizeObserver', () => {
  beforeEach(() => {
    saveGlobals()
    setupWindowMock()
    installObserverMocks()
  })
  afterEach(() => restoreGlobals())

  it('should return isSupported as true when ResizeObserver is available', () => {
    const el = createMockElement()
    const { isSupported } = useResizeObserver(el, () => {})
    expect(isSupported.value).toBe(true)
  })

  it('should observe the target element', () => {
    const el = createMockElement()
    useResizeObserver(el, () => {})
    const instance = MockResizeObserver.instances[MockResizeObserver.instances.length - 1]
    expect(instance.targets).toContain(el)
  })

  it('should call the callback when element resizes', () => {
    const el = createMockElement()
    const cb = mock(() => {})
    useResizeObserver(el, cb)
    const instance = MockResizeObserver.instances[MockResizeObserver.instances.length - 1]
    instance.trigger([{ contentRect: { width: 200, height: 100 } }])
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('should disconnect on stop', () => {
    const el = createMockElement()
    const { stop } = useResizeObserver(el, () => {})
    const instance = MockResizeObserver.instances[MockResizeObserver.instances.length - 1]
    stop()
    expect(instance.targets.length).toBe(0)
  })

  it('should not throw when target is null', () => {
    expect(() => useResizeObserver(null, () => {})).not.toThrow()
  })

  it('should be SSR-safe when window is undefined', () => {
    delete (globalThis as any).window
    expect(() => useResizeObserver(null, () => {})).not.toThrow()
  })

  it('should handle multiple resize triggers', () => {
    const el = createMockElement()
    const cb = mock(() => {})
    useResizeObserver(el, cb)
    const instance = MockResizeObserver.instances[MockResizeObserver.instances.length - 1]
    instance.trigger([{ contentRect: { width: 100, height: 50 } }])
    instance.trigger([{ contentRect: { width: 200, height: 100 } }])
    expect(cb).toHaveBeenCalledTimes(2)
  })

  it('stop should be idempotent', () => {
    const el = createMockElement()
    const { stop } = useResizeObserver(el, () => {})
    stop()
    expect(() => stop()).not.toThrow()
  })
})

describe('useMutationObserver', () => {
  beforeEach(() => {
    saveGlobals()
    setupWindowMock()
    installObserverMocks()
  })
  afterEach(() => restoreGlobals())

  it('should return isSupported as true when MutationObserver is available', () => {
    const el = createMockElement()
    const { isSupported } = useMutationObserver(el, () => {})
    expect(isSupported.value).toBe(true)
  })

  it('should observe the target element', () => {
    const el = createMockElement()
    useMutationObserver(el, () => {}, { childList: true })
    const instance = MockMutationObserver.instances[MockMutationObserver.instances.length - 1]
    expect(instance.targets.length).toBe(1)
  })

  it('should call the callback on mutations', () => {
    const el = createMockElement()
    const cb = mock(() => {})
    useMutationObserver(el, cb, { childList: true })
    const instance = MockMutationObserver.instances[MockMutationObserver.instances.length - 1]
    instance.trigger([{ type: 'childList', target: el }])
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('should disconnect on stop', () => {
    const el = createMockElement()
    const { stop } = useMutationObserver(el, () => {})
    const instance = MockMutationObserver.instances[MockMutationObserver.instances.length - 1]
    stop()
    expect(instance.targets.length).toBe(0)
  })

  it('should not throw when target is null', () => {
    expect(() => useMutationObserver(null, () => {})).not.toThrow()
  })

  it('should be SSR-safe when window is undefined', () => {
    delete (globalThis as any).window
    expect(() => useMutationObserver(null, () => {})).not.toThrow()
  })

  it('should use default options when none provided', () => {
    const el = createMockElement()
    expect(() => useMutationObserver(el, () => {})).not.toThrow()
  })

  it('should handle multiple mutation triggers', () => {
    const el = createMockElement()
    const cb = mock(() => {})
    useMutationObserver(el, cb)
    const instance = MockMutationObserver.instances[MockMutationObserver.instances.length - 1]
    instance.trigger([{ type: 'childList' }])
    instance.trigger([{ type: 'attributes' }])
    instance.trigger([{ type: 'characterData' }])
    expect(cb).toHaveBeenCalledTimes(3)
  })
})

describe('useElementSize', () => {
  beforeEach(() => {
    saveGlobals()
    setupWindowMock()
    installObserverMocks()
  })
  afterEach(() => restoreGlobals())

  it('should return initial size of 0 by default', () => {
    const { width, height } = useElementSize(null)
    expect(width.value).toBe(0)
    expect(height.value).toBe(0)
  })

  it('should use custom initial size when provided', () => {
    const { width, height } = useElementSize(null, { initialSize: { width: 100, height: 50 } })
    expect(width.value).toBe(100)
    expect(height.value).toBe(50)
  })

  it('should observe the target element with ResizeObserver', () => {
    const el = createMockElement()
    useElementSize(el)
    const instance = MockResizeObserver.instances[MockResizeObserver.instances.length - 1]
    expect(instance).toBeDefined()
    expect(instance.targets).toContain(el)
  })

  it('should update width and height from contentRect', () => {
    const el = createMockElement()
    const { width, height } = useElementSize(el)
    const instance = MockResizeObserver.instances[MockResizeObserver.instances.length - 1]
    instance.trigger([{ contentRect: { width: 300, height: 200 } }])
    expect(width.value).toBe(300)
    expect(height.value).toBe(200)
  })

  it('should update from contentBoxSize when available', () => {
    const el = createMockElement()
    const { width, height } = useElementSize(el)
    const instance = MockResizeObserver.instances[MockResizeObserver.instances.length - 1]
    instance.trigger([{
      contentBoxSize: [{ inlineSize: 400, blockSize: 250 }],
      contentRect: { width: 300, height: 200 },
    }])
    expect(width.value).toBe(400)
    expect(height.value).toBe(250)
  })

  it('should stop observing when stop is called', () => {
    const el = createMockElement()
    const { stop } = useElementSize(el)
    const instance = MockResizeObserver.instances[MockResizeObserver.instances.length - 1]
    stop()
    expect(instance.targets.length).toBe(0)
  })

  it('should be SSR-safe when window is undefined', () => {
    delete (globalThis as any).window
    expect(() => useElementSize(null)).not.toThrow()
  })

  it('should not throw when target is null', () => {
    expect(() => useElementSize(null)).not.toThrow()
  })
})

describe('useElementBounding', () => {
  beforeEach(() => {
    saveGlobals()
    setupWindowMock()
    installObserverMocks()
  })
  afterEach(() => restoreGlobals())

  it('should return all bounding rect properties as refs', () => {
    const el = createMockElement()
    const result = useElementBounding(el)
    expect(result.x).toBeDefined()
    expect(result.y).toBeDefined()
    expect(result.top).toBeDefined()
    expect(result.right).toBeDefined()
    expect(result.bottom).toBeDefined()
    expect(result.left).toBeDefined()
    expect(result.width).toBeDefined()
    expect(result.height).toBeDefined()
  })

  it('should read initial bounding rect from the element', () => {
    const el = createMockElement()
    const { x, y, width, height, top, left, right, bottom } = useElementBounding(el)
    expect(x.value).toBe(10)
    expect(y.value).toBe(20)
    expect(top.value).toBe(20)
    expect(right.value).toBe(110)
    expect(bottom.value).toBe(120)
    expect(left.value).toBe(10)
    expect(width.value).toBe(100)
    expect(height.value).toBe(100)
  })

  it('should default to 0 when target is null', () => {
    const { x, y, width, height } = useElementBounding(null)
    expect(x.value).toBe(0)
    expect(y.value).toBe(0)
    expect(width.value).toBe(0)
    expect(height.value).toBe(0)
  })

  it('should update on manual update call', () => {
    const el = createMockElement()
    const result = useElementBounding(el)
    ;(el as any).getBoundingClientRect = () => ({
      x: 50, y: 60, top: 60, right: 250, bottom: 260, left: 50, width: 200, height: 200, toJSON: () => {},
    })
    result.update()
    expect(result.x.value).toBe(50)
    expect(result.y.value).toBe(60)
    expect(result.width.value).toBe(200)
  })

  it('should listen for window resize events', () => {
    const win = (globalThis as any).window
    const el = createMockElement()
    useElementBounding(el)
    expect(win.__listeners['resize']).toBeDefined()
    expect(win.__listeners['resize'].size).toBeGreaterThan(0)
  })

  it('should listen for window scroll events', () => {
    const win = (globalThis as any).window
    const el = createMockElement()
    useElementBounding(el)
    expect(win.__listeners['scroll']).toBeDefined()
    expect(win.__listeners['scroll'].size).toBeGreaterThan(0)
  })

  it('should be SSR-safe when window is undefined', () => {
    delete (globalThis as any).window
    expect(() => useElementBounding(null)).not.toThrow()
  })

  it('should provide an update function', () => {
    const el = createMockElement()
    const result = useElementBounding(el)
    expect(typeof result.update).toBe('function')
  })
})

describe('useElementVisibility', () => {
  beforeEach(() => {
    saveGlobals()
    setupWindowMock()
    installObserverMocks()
  })
  afterEach(() => restoreGlobals())

  it('should return a ref that defaults to false', () => {
    const el = createMockElement()
    const isVisible = useElementVisibility(el)
    expect(isVisible.value).toBe(false)
  })

  it('should become true when element intersects', () => {
    const el = createMockElement()
    const isVisible = useElementVisibility(el)
    const observer = MockIntersectionObserver.instances[MockIntersectionObserver.instances.length - 1]
    observer.trigger([{ isIntersecting: true, target: el }])
    expect(isVisible.value).toBe(true)
  })

  it('should become false when element stops intersecting', () => {
    const el = createMockElement()
    const isVisible = useElementVisibility(el)
    const observer = MockIntersectionObserver.instances[MockIntersectionObserver.instances.length - 1]
    observer.trigger([{ isIntersecting: true, target: el }])
    expect(isVisible.value).toBe(true)
    observer.trigger([{ isIntersecting: false, target: el }])
    expect(isVisible.value).toBe(false)
  })

  it('should use IntersectionObserver internally', () => {
    const el = createMockElement()
    useElementVisibility(el)
    expect(MockIntersectionObserver.instances.length).toBeGreaterThan(0)
  })

  it('should not throw when target is null', () => {
    expect(() => useElementVisibility(null)).not.toThrow()
  })

  it('should be SSR-safe when window is undefined', () => {
    delete (globalThis as any).window
    expect(() => useElementVisibility(null)).not.toThrow()
  })

  it('should handle rapid intersection changes', () => {
    const el = createMockElement()
    const isVisible = useElementVisibility(el)
    const observer = MockIntersectionObserver.instances[MockIntersectionObserver.instances.length - 1]
    observer.trigger([{ isIntersecting: true }])
    observer.trigger([{ isIntersecting: false }])
    observer.trigger([{ isIntersecting: true }])
    expect(isVisible.value).toBe(true)
  })

  it('should handle multiple entries (use last entry)', () => {
    const el = createMockElement()
    const isVisible = useElementVisibility(el)
    const observer = MockIntersectionObserver.instances[MockIntersectionObserver.instances.length - 1]
    observer.trigger([
      { isIntersecting: true },
      { isIntersecting: false },
    ])
    expect(isVisible.value).toBe(false)
  })
})

describe('useMouse', () => {
  beforeEach(() => {
    saveGlobals()
    setupWindowMock()
  })
  afterEach(() => restoreGlobals())

  it('should return initial values of 0 by default', () => {
    const { x, y, sourceType } = useMouse()
    expect(x.value).toBe(0)
    expect(y.value).toBe(0)
    expect(sourceType.value).toBeNull()
  })

  it('should use custom initial values', () => {
    const { x, y } = useMouse({ initialValue: { x: 100, y: 200 } })
    expect(x.value).toBe(100)
    expect(y.value).toBe(200)
  })

  it('should update on mousemove events using page coordinates by default', () => {
    const win = (globalThis as any).window
    const { x, y, sourceType } = useMouse()
    const event = { pageX: 150, pageY: 250, clientX: 140, clientY: 240, screenX: 160, screenY: 260 }
    for (const h of win.__listeners['mousemove']) h(event)
    expect(x.value).toBe(150)
    expect(y.value).toBe(250)
    expect(sourceType.value).toBe('mouse')
  })

  it('should track client coordinates when type is client', () => {
    const win = (globalThis as any).window
    const { x, y } = useMouse({ type: 'client' })
    const event = { pageX: 150, pageY: 250, clientX: 140, clientY: 240, screenX: 160, screenY: 260 }
    for (const h of win.__listeners['mousemove']) h(event)
    expect(x.value).toBe(140)
    expect(y.value).toBe(240)
  })

  it('should track screen coordinates when type is screen', () => {
    const win = (globalThis as any).window
    const { x, y } = useMouse({ type: 'screen' })
    const event = { pageX: 150, pageY: 250, clientX: 140, clientY: 240, screenX: 160, screenY: 260 }
    for (const h of win.__listeners['mousemove']) h(event)
    expect(x.value).toBe(160)
    expect(y.value).toBe(260)
  })

  it('should track touch events by default', () => {
    const win = (globalThis as any).window
    const { x, y, sourceType } = useMouse()
    expect(win.__listeners['touchstart']).toBeDefined()
    expect(win.__listeners['touchmove']).toBeDefined()
    const touchEvent = { touches: [{ pageX: 300, pageY: 400, clientX: 290, clientY: 390, screenX: 310, screenY: 410 }] }
    for (const h of win.__listeners['touchstart']) h(touchEvent)
    expect(x.value).toBe(300)
    expect(y.value).toBe(400)
    expect(sourceType.value).toBe('touch')
  })

  it('should not track touch events when touch is false', () => {
    const win = (globalThis as any).window
    useMouse({ touch: false })
    expect(win.__listeners['touchstart']).toBeUndefined()
    expect(win.__listeners['touchmove']).toBeUndefined()
  })

  it('should be SSR-safe when window is undefined', () => {
    delete (globalThis as any).window
    expect(() => useMouse()).not.toThrow()
  })

  it('should handle multiple mousemove events', () => {
    const win = (globalThis as any).window
    const { x, y } = useMouse()
    for (const h of win.__listeners['mousemove']) h({ pageX: 10, pageY: 20 })
    expect(x.value).toBe(10)
    for (const h of win.__listeners['mousemove']) h({ pageX: 30, pageY: 40 })
    expect(x.value).toBe(30)
    expect(y.value).toBe(40)
  })
})

describe('useGeolocation', () => {
  let geoMock: any

  function setupGeolocationMock() {
    let watchCallback: ((pos: any) => void) | null = null
    let errorCallback: ((err: any) => void) | null = null
    let watchId = 1

    const geolocation = {
      watchPosition: mock((success: any, error: any, _opts: any) => {
        watchCallback = success
        errorCallback = error
        return watchId++
      }),
      clearWatch: mock(() => {}),
      getCurrentPosition: mock(() => {}),
      _triggerPosition: (pos: any) => watchCallback?.(pos),
      _triggerError: (err: any) => errorCallback?.(err),
    }

    ;(globalThis as any).navigator = { geolocation }
    return geolocation
  }

  beforeEach(() => {
    saveGlobals()
    setupWindowMock()
    geoMock = setupGeolocationMock()
  })
  afterEach(() => restoreGlobals())

  it('should return isSupported as true when geolocation is available', () => {
    const { isSupported } = useGeolocation()
    expect(isSupported.value).toBe(true)
  })

  it('should start watching immediately by default', () => {
    useGeolocation()
    expect(geoMock.watchPosition).toHaveBeenCalled()
  })

  it('should not start watching when immediate is false', () => {
    useGeolocation({ immediate: false })
    expect(geoMock.watchPosition).not.toHaveBeenCalled()
  })

  it('should update coords on position change', () => {
    const { coords, locatedAt } = useGeolocation()
    geoMock._triggerPosition({
      coords: {
        latitude: 51.5074,
        longitude: -0.1278,
        accuracy: 10,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: 1234567890,
    })
    expect(coords.latitude.value).toBe(51.5074)
    expect(coords.longitude.value).toBe(-0.1278)
    expect(coords.accuracy.value).toBe(10)
    expect(locatedAt.value).toBe(1234567890)
  })

  it('should update error on geolocation error', () => {
    const { error } = useGeolocation()
    const geoError = { code: 1, message: 'Permission denied' }
    geoMock._triggerError(geoError)
    expect(error.value).toEqual(geoError)
  })

  it('should pause and resume watching', () => {
    const { pause, resume } = useGeolocation()
    pause()
    expect(geoMock.clearWatch).toHaveBeenCalled()
    resume()
    expect(geoMock.watchPosition).toHaveBeenCalledTimes(2)
  })

  it('should initialize coords as null', () => {
    const { coords } = useGeolocation()
    expect(coords.latitude.value).toBeNull()
    expect(coords.longitude.value).toBeNull()
    expect(coords.altitude.value).toBeNull()
  })

  it('should be SSR-safe when navigator is undefined', () => {
    delete (globalThis as any).navigator
    const { isSupported } = useGeolocation()
    expect(isSupported.value).toBe(false)
  })
})

describe('useDeviceMotion', () => {
  beforeEach(() => {
    saveGlobals()
    const win = setupWindowMock()
    win.DeviceMotionEvent = class {} as any
  })
  afterEach(() => restoreGlobals())

  it('should return isSupported as true when DeviceMotionEvent exists', () => {
    const { isSupported } = useDeviceMotion()
    expect(isSupported.value).toBe(true)
  })

  it('should initialize acceleration values as null', () => {
    const { acceleration } = useDeviceMotion()
    expect(acceleration.x.value).toBeNull()
    expect(acceleration.y.value).toBeNull()
    expect(acceleration.z.value).toBeNull()
  })

  it('should update acceleration on devicemotion event', () => {
    const win = (globalThis as any).window
    const { acceleration } = useDeviceMotion()
    const event = {
      type: 'devicemotion',
      acceleration: { x: 1.5, y: 2.5, z: 3.5 },
      accelerationIncludingGravity: { x: 1, y: 9.8, z: 0 },
      rotationRate: { alpha: 10, beta: 20, gamma: 30 },
      interval: 16,
    }
    for (const h of win.__listeners['devicemotion']) h(event)
    expect(acceleration.x.value).toBe(1.5)
    expect(acceleration.y.value).toBe(2.5)
    expect(acceleration.z.value).toBe(3.5)
  })

  it('should update accelerationIncludingGravity on event', () => {
    const win = (globalThis as any).window
    const { accelerationIncludingGravity } = useDeviceMotion()
    const event = {
      acceleration: { x: 0, y: 0, z: 0 },
      accelerationIncludingGravity: { x: 1, y: 9.8, z: 0.5 },
      rotationRate: { alpha: 0, beta: 0, gamma: 0 },
      interval: 16,
    }
    for (const h of win.__listeners['devicemotion']) h(event)
    expect(accelerationIncludingGravity.x.value).toBe(1)
    expect(accelerationIncludingGravity.y.value).toBe(9.8)
    expect(accelerationIncludingGravity.z.value).toBe(0.5)
  })

  it('should update rotationRate on event', () => {
    const win = (globalThis as any).window
    const { rotationRate } = useDeviceMotion()
    const event = {
      acceleration: { x: 0, y: 0, z: 0 },
      accelerationIncludingGravity: { x: 0, y: 0, z: 0 },
      rotationRate: { alpha: 10, beta: 20, gamma: 30 },
      interval: 16,
    }
    for (const h of win.__listeners['devicemotion']) h(event)
    expect(rotationRate.alpha.value).toBe(10)
    expect(rotationRate.beta.value).toBe(20)
    expect(rotationRate.gamma.value).toBe(30)
  })

  it('should update interval on event', () => {
    const win = (globalThis as any).window
    const { interval } = useDeviceMotion()
    const event = {
      acceleration: null,
      accelerationIncludingGravity: null,
      rotationRate: null,
      interval: 33,
    }
    for (const h of win.__listeners['devicemotion']) h(event)
    expect(interval.value).toBe(33)
  })

  it('should register a devicemotion event listener', () => {
    const win = (globalThis as any).window
    useDeviceMotion()
    expect(win.__listeners['devicemotion']).toBeDefined()
    expect(win.__listeners['devicemotion'].size).toBeGreaterThan(0)
  })

  it('should be SSR-safe when window is undefined', () => {
    delete (globalThis as any).window
    expect(() => useDeviceMotion()).not.toThrow()
  })

  it('should handle null acceleration gracefully', () => {
    const win = (globalThis as any).window
    const { acceleration } = useDeviceMotion()
    const event = {
      acceleration: null,
      accelerationIncludingGravity: null,
      rotationRate: null,
      interval: 16,
    }
    for (const h of win.__listeners['devicemotion']) h(event)
    expect(acceleration.x.value).toBeNull()
  })
})

describe('useDeviceOrientation', () => {
  beforeEach(() => {
    saveGlobals()
    const win = setupWindowMock()
    win.DeviceOrientationEvent = class {} as any
  })
  afterEach(() => restoreGlobals())

  it('should return isSupported as true when DeviceOrientationEvent exists', () => {
    const { isSupported } = useDeviceOrientation()
    expect(isSupported.value).toBe(true)
  })

  it('should initialize values as null/false', () => {
    const { alpha, beta, gamma, absolute } = useDeviceOrientation()
    expect(alpha.value).toBeNull()
    expect(beta.value).toBeNull()
    expect(gamma.value).toBeNull()
    expect(absolute.value).toBe(false)
  })

  it('should update orientation values on event', () => {
    const win = (globalThis as any).window
    const { alpha, beta, gamma, absolute } = useDeviceOrientation()
    const event = { alpha: 45, beta: 90, gamma: -10, absolute: true }
    for (const h of win.__listeners['deviceorientation']) h(event)
    expect(alpha.value).toBe(45)
    expect(beta.value).toBe(90)
    expect(gamma.value).toBe(-10)
    expect(absolute.value).toBe(true)
  })

  it('should register a deviceorientation event listener', () => {
    const win = (globalThis as any).window
    useDeviceOrientation()
    expect(win.__listeners['deviceorientation']).toBeDefined()
    expect(win.__listeners['deviceorientation'].size).toBeGreaterThan(0)
  })

  it('should be SSR-safe when window is undefined', () => {
    delete (globalThis as any).window
    expect(() => useDeviceOrientation()).not.toThrow()
  })

  it('should handle null orientation values', () => {
    const win = (globalThis as any).window
    const { alpha, beta, gamma } = useDeviceOrientation()
    for (const h of win.__listeners['deviceorientation']) h({ alpha: null, beta: null, gamma: null, absolute: false })
    expect(alpha.value).toBeNull()
    expect(beta.value).toBeNull()
    expect(gamma.value).toBeNull()
  })

  it('should handle multiple orientation updates', () => {
    const win = (globalThis as any).window
    const { alpha } = useDeviceOrientation()
    for (const h of win.__listeners['deviceorientation']) h({ alpha: 10, beta: 0, gamma: 0, absolute: false })
    expect(alpha.value).toBe(10)
    for (const h of win.__listeners['deviceorientation']) h({ alpha: 20, beta: 0, gamma: 0, absolute: false })
    expect(alpha.value).toBe(20)
    for (const h of win.__listeners['deviceorientation']) h({ alpha: 350, beta: 0, gamma: 0, absolute: false })
    expect(alpha.value).toBe(350)
  })

  it('should update absolute flag correctly', () => {
    const win = (globalThis as any).window
    const { absolute } = useDeviceOrientation()
    for (const h of win.__listeners['deviceorientation']) h({ alpha: 0, beta: 0, gamma: 0, absolute: true })
    expect(absolute.value).toBe(true)
    for (const h of win.__listeners['deviceorientation']) h({ alpha: 0, beta: 0, gamma: 0, absolute: false })
    expect(absolute.value).toBe(false)
  })
})

describe('useBattery', () => {
  function setupBatteryMock(initialValues?: Partial<{ charging: boolean, chargingTime: number, dischargingTime: number, level: number }>) {
    const batteryListeners: Record<string, Set<EventListener>> = {}
    const batteryManager = {
      charging: initialValues?.charging ?? true,
      chargingTime: initialValues?.chargingTime ?? 0,
      dischargingTime: initialValues?.dischargingTime ?? Infinity,
      level: initialValues?.level ?? 0.75,
      addEventListener: (type: string, listener: EventListener) => {
        if (!batteryListeners[type]) batteryListeners[type] = new Set()
        batteryListeners[type].add(listener)
      },
      removeEventListener: (type: string, listener: EventListener) => {
        batteryListeners[type]?.delete(listener)
      },
      _trigger: (type: string) => {
        const handlers = batteryListeners[type]
        if (handlers) {
          for (const h of handlers) h(new Event(type))
        }
      },
      __listeners: batteryListeners,
    }
    ;(globalThis as any).navigator = {
      getBattery: mock(() => Promise.resolve(batteryManager)),
    }
    return batteryManager
  }

  beforeEach(() => {
    saveGlobals()
    setupWindowMock()
  })
  afterEach(() => restoreGlobals())

  it('should return isSupported as true when getBattery is available', () => {
    setupBatteryMock()
    const { isSupported } = useBattery()
    expect(isSupported.value).toBe(true)
  })

  it('should read initial battery values', async () => {
    setupBatteryMock({ charging: true, level: 0.8 })
    const { charging, level } = useBattery()
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(charging.value).toBe(true)
    expect(level.value).toBe(0.8)
  })

  it('should update on chargingchange event', async () => {
    const battery = setupBatteryMock({ charging: true })
    const { charging } = useBattery()
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(charging.value).toBe(true)
    battery.charging = false
    battery._trigger('chargingchange')
    expect(charging.value).toBe(false)
  })

  it('should update on levelchange event', async () => {
    const battery = setupBatteryMock({ level: 0.5 })
    const { level } = useBattery()
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(level.value).toBe(0.5)
    battery.level = 0.3
    battery._trigger('levelchange')
    expect(level.value).toBe(0.3)
  })

  it('should default level to 1 before battery promise resolves', () => {
    setupBatteryMock()
    const { level } = useBattery()
    expect(level.value).toBe(1)
  })

  it('should register event listeners on battery manager', async () => {
    const battery = setupBatteryMock()
    useBattery()
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(battery.__listeners['chargingchange']?.size).toBeGreaterThan(0)
    expect(battery.__listeners['chargingtimechange']?.size).toBeGreaterThan(0)
    expect(battery.__listeners['dischargingtimechange']?.size).toBeGreaterThan(0)
    expect(battery.__listeners['levelchange']?.size).toBeGreaterThan(0)
  })

  it('should be SSR-safe when navigator is undefined', () => {
    delete (globalThis as any).navigator
    const { isSupported } = useBattery()
    expect(isSupported.value).toBe(false)
  })

  it('should handle navigator without getBattery', () => {
    ;(globalThis as any).navigator = {}
    const { isSupported } = useBattery()
    expect(isSupported.value).toBe(false)
  })

  it('should handle chargingtimechange and dischargingtimechange events', async () => {
    const battery = setupBatteryMock({ chargingTime: 3600, dischargingTime: 7200 })
    const { chargingTime, dischargingTime } = useBattery()
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(chargingTime.value).toBe(3600)
    expect(dischargingTime.value).toBe(7200)
    battery.chargingTime = 1800
    battery._trigger('chargingtimechange')
    expect(chargingTime.value).toBe(1800)
    battery.dischargingTime = 3600
    battery._trigger('dischargingtimechange')
    expect(dischargingTime.value).toBe(3600)
  })
})

describe('useIdle', () => {
  let originalSetTimeout: typeof setTimeout
  let originalClearTimeout: typeof clearTimeout

  beforeEach(() => {
    saveGlobals()
    setupWindowMock()
    originalSetTimeout = globalThis.setTimeout
    originalClearTimeout = globalThis.clearTimeout
  })
  afterEach(() => {
    globalThis.setTimeout = originalSetTimeout
    globalThis.clearTimeout = originalClearTimeout
    restoreGlobals()
  })

  it('should return idle as false initially by default', () => {
    const { idle } = useIdle()
    expect(idle.value).toBe(false)
  })

  it('should allow setting initial state', () => {
    const { idle } = useIdle(60000, { initialState: true })
    expect(idle.value).toBe(true)
  })

  it('should return lastActive as a recent timestamp', () => {
    const before = Date.now()
    const { lastActive } = useIdle()
    const after = Date.now()
    expect(lastActive.value).toBeGreaterThanOrEqual(before)
    expect(lastActive.value).toBeLessThanOrEqual(after)
  })

  it('should become idle after timeout', async () => {
    const { idle } = useIdle(50)
    expect(idle.value).toBe(false)
    await new Promise(resolve => originalSetTimeout(resolve, 100))
    expect(idle.value).toBe(true)
  })

  it('should reset idle on user activity', async () => {
    const win = (globalThis as any).window
    const { idle, lastActive } = useIdle(100)
    const prevLastActive = lastActive.value
    await new Promise(resolve => originalSetTimeout(resolve, 10))
    if (win.__listeners['mousemove']) {
      for (const h of win.__listeners['mousemove']) h(new Event('mousemove'))
    }
    expect(idle.value).toBe(false)
    expect(lastActive.value).toBeGreaterThanOrEqual(prevLastActive)
  })

  it('should listen for default events', () => {
    const win = (globalThis as any).window
    useIdle()
    const expectedEvents = ['mousemove', 'mousedown', 'resize', 'keydown', 'touchstart', 'wheel']
    for (const event of expectedEvents) {
      expect(win.__listeners[event]).toBeDefined()
      expect(win.__listeners[event].size).toBeGreaterThan(0)
    }
  })

  it('should accept custom events', () => {
    const win = (globalThis as any).window
    useIdle(60000, { events: ['click', 'scroll'] })
    expect(win.__listeners['click']).toBeDefined()
    expect(win.__listeners['scroll']).toBeDefined()
    expect(win.__listeners['wheel']).toBeUndefined()
  })

  it('should be SSR-safe when window is undefined', () => {
    delete (globalThis as any).window
    expect(() => useIdle()).not.toThrow()
  })
})

describe('usePageLeave', () => {
  beforeEach(() => {
    saveGlobals()
    setupWindowMock()
    setupDocumentMock()
  })
  afterEach(() => restoreGlobals())

  it('should return false initially', () => {
    const isLeft = usePageLeave()
    expect(isLeft.value).toBe(false)
  })

  it('should register mouseleave and mouseenter listeners', () => {
    const docEl = (globalThis as any).document.documentElement
    usePageLeave()
    expect(docEl.__listeners['mouseleave']).toBeDefined()
    expect(docEl.__listeners['mouseenter']).toBeDefined()
  })

  it('should become true when mouse leaves the page (top)', () => {
    const docEl = (globalThis as any).document.documentElement
    const isLeft = usePageLeave()
    for (const h of docEl.__listeners['mouseleave']) h({ type: 'mouseleave', clientX: 500, clientY: -1 })
    expect(isLeft.value).toBe(true)
  })

  it('should become true when mouse leaves the page (left)', () => {
    const docEl = (globalThis as any).document.documentElement
    const isLeft = usePageLeave()
    for (const h of docEl.__listeners['mouseleave']) h({ type: 'mouseleave', clientX: -1, clientY: 400 })
    expect(isLeft.value).toBe(true)
  })

  it('should become false when mouse enters back', () => {
    const docEl = (globalThis as any).document.documentElement
    const isLeft = usePageLeave()
    for (const h of docEl.__listeners['mouseleave']) h({ type: 'mouseleave', clientX: 500, clientY: -1 })
    expect(isLeft.value).toBe(true)
    for (const h of docEl.__listeners['mouseenter']) h({ type: 'mouseenter' })
    expect(isLeft.value).toBe(false)
  })

  it('should detect leaving from the right edge', () => {
    const docEl = (globalThis as any).document.documentElement
    const isLeft = usePageLeave()
    for (const h of docEl.__listeners['mouseleave']) h({ type: 'mouseleave', clientX: 1024, clientY: 400 })
    expect(isLeft.value).toBe(true)
  })

  it('should detect leaving from the bottom edge', () => {
    const docEl = (globalThis as any).document.documentElement
    const isLeft = usePageLeave()
    for (const h of docEl.__listeners['mouseleave']) h({ type: 'mouseleave', clientX: 500, clientY: 768 })
    expect(isLeft.value).toBe(true)
  })

  it('should be SSR-safe when document is undefined', () => {
    delete (globalThis as any).document
    expect(() => usePageLeave()).not.toThrow()
  })

  it('should not be left when mouse is inside the page', () => {
    const docEl = (globalThis as any).document.documentElement
    const isLeft = usePageLeave()
    for (const h of docEl.__listeners['mouseleave']) h({ type: 'mouseleave', clientX: 500, clientY: 400 })
    expect(isLeft.value).toBe(false)
  })
})

describe('useDraggable', () => {
  beforeEach(() => {
    saveGlobals()
    setupWindowMock()
  })
  afterEach(() => restoreGlobals())

  it('should return initial position of 0,0 by default', () => {
    const el = createMockElement()
    const { x, y } = useDraggable(el)
    expect(x.value).toBe(0)
    expect(y.value).toBe(0)
  })

  it('should use custom initial values', () => {
    const el = createMockElement()
    const { x, y } = useDraggable(el, { initialValue: { x: 50, y: 100 } })
    expect(x.value).toBe(50)
    expect(y.value).toBe(100)
  })

  it('should return isDragging as false initially', () => {
    const el = createMockElement()
    const { isDragging } = useDraggable(el)
    expect(isDragging.value).toBe(false)
  })

  it('should return a style string', () => {
    const el = createMockElement()
    const { style } = useDraggable(el, { initialValue: { x: 10, y: 20 } })
    expect(style.value).toBe('left: 10px; top: 20px;')
  })

  it('should start dragging on pointerdown', () => {
    const el = createMockElement()
    const { isDragging } = useDraggable(el)
    for (const h of el.__listeners['pointerdown']) h({ clientX: 10, clientY: 20, type: 'pointerdown' } as any)
    expect(isDragging.value).toBe(true)
  })

  it('should update position on pointermove while dragging', () => {
    const win = (globalThis as any).window
    const el = createMockElement()
    const { x, y, isDragging } = useDraggable(el)
    for (const h of el.__listeners['pointerdown']) h({ clientX: 0, clientY: 0 } as any)
    expect(isDragging.value).toBe(true)
    if (win.__listeners['pointermove']) {
      for (const h of win.__listeners['pointermove']) h({ clientX: 50, clientY: 75 })
    }
    expect(x.value).toBe(50)
    expect(y.value).toBe(75)
  })

  it('should stop dragging on pointerup', () => {
    const win = (globalThis as any).window
    const el = createMockElement()
    const { isDragging } = useDraggable(el)
    for (const h of el.__listeners['pointerdown']) h({ clientX: 0, clientY: 0 } as any)
    expect(isDragging.value).toBe(true)
    if (win.__listeners['pointerup']) {
      for (const h of win.__listeners['pointerup']) h({ clientX: 50, clientY: 50 })
    }
    expect(isDragging.value).toBe(false)
  })

  it('should call onStart callback', () => {
    const el = createMockElement()
    const onStart = mock(() => {})
    useDraggable(el, { onStart })
    for (const h of el.__listeners['pointerdown']) h({ clientX: 10, clientY: 20 } as any)
    expect(onStart).toHaveBeenCalled()
  })

  it('should prevent drag when onStart returns false', () => {
    const el = createMockElement()
    const onStart = mock(() => false as const)
    const { isDragging } = useDraggable(el, { onStart })
    for (const h of el.__listeners['pointerdown']) h({ clientX: 10, clientY: 20 } as any)
    expect(isDragging.value).toBe(false)
  })

  it('should call onEnd callback when drag ends', () => {
    const win = (globalThis as any).window
    const el = createMockElement()
    const onEnd = mock(() => {})
    useDraggable(el, { onEnd })
    for (const h of el.__listeners['pointerdown']) h({ clientX: 0, clientY: 0 } as any)
    if (win.__listeners['pointerup']) {
      for (const h of win.__listeners['pointerup']) h({ clientX: 50, clientY: 50 })
    }
    expect(onEnd).toHaveBeenCalled()
  })

  it('should not throw when target is null', () => {
    expect(() => useDraggable(null)).not.toThrow()
  })

  it('should be SSR-safe when window is undefined', () => {
    delete (globalThis as any).window
    expect(() => useDraggable(null)).not.toThrow()
  })
})

describe('useDropZone', () => {
  beforeEach(() => {
    saveGlobals()
    setupWindowMock()
  })
  afterEach(() => restoreGlobals())

  it('should return isOverDropZone as false initially', () => {
    const el = createMockElement()
    const { isOverDropZone } = useDropZone(el)
    expect(isOverDropZone.value).toBe(false)
  })

  it('should return files as null initially', () => {
    const el = createMockElement()
    const { files } = useDropZone(el)
    expect(files.value).toBeNull()
  })

  it('should set isOverDropZone to true on dragenter', () => {
    const el = createMockElement()
    const { isOverDropZone } = useDropZone(el)
    for (const h of el.__listeners['dragenter']) h({ type: 'dragenter', preventDefault: () => {} } as any)
    expect(isOverDropZone.value).toBe(true)
  })

  it('should set isOverDropZone to false on dragleave', () => {
    const el = createMockElement()
    const { isOverDropZone } = useDropZone(el)
    for (const h of el.__listeners['dragenter']) h({ preventDefault: () => {} } as any)
    expect(isOverDropZone.value).toBe(true)
    for (const h of el.__listeners['dragleave']) h({ preventDefault: () => {} } as any)
    expect(isOverDropZone.value).toBe(false)
  })

  it('should handle nested dragenter/dragleave correctly', () => {
    const el = createMockElement()
    const { isOverDropZone } = useDropZone(el)
    for (const h of el.__listeners['dragenter']) h({ preventDefault: () => {} } as any)
    for (const h of el.__listeners['dragenter']) h({ preventDefault: () => {} } as any)
    for (const h of el.__listeners['dragleave']) h({ preventDefault: () => {} } as any)
    expect(isOverDropZone.value).toBe(true)
    for (const h of el.__listeners['dragleave']) h({ preventDefault: () => {} } as any)
    expect(isOverDropZone.value).toBe(false)
  })

  it('should capture dropped files', () => {
    const el = createMockElement()
    const { files, isOverDropZone } = useDropZone(el)
    for (const h of el.__listeners['dragenter']) h({ preventDefault: () => {} } as any)
    const mockFile = new File(['content'], 'test.txt', { type: 'text/plain' })
    const fileList = { length: 1, 0: mockFile, [Symbol.iterator]: function* () { yield mockFile } }
    for (const h of el.__listeners['drop']) h({ type: 'drop', preventDefault: () => {}, dataTransfer: { files: fileList } } as any)
    expect(isOverDropZone.value).toBe(false)
    expect(files.value).not.toBeNull()
    expect(files.value?.length).toBe(1)
  })

  it('should call onDrop callback when files are dropped', () => {
    const el = createMockElement()
    const onDrop = mock(() => {})
    useDropZone(el, onDrop)
    const mockFile = new File(['content'], 'test.txt', { type: 'text/plain' })
    const fileList = { length: 1, 0: mockFile, [Symbol.iterator]: function* () { yield mockFile } }
    for (const h of el.__listeners['drop']) h({ type: 'drop', preventDefault: () => {}, dataTransfer: { files: fileList } } as any)
    expect(onDrop).toHaveBeenCalled()
  })

  it('should set files to null when no files in drop', () => {
    const el = createMockElement()
    const { files } = useDropZone(el)
    for (const h of el.__listeners['drop']) h({ type: 'drop', preventDefault: () => {}, dataTransfer: { files: { length: 0 } } } as any)
    expect(files.value).toBeNull()
  })

  it('should not throw when target is null', () => {
    expect(() => useDropZone(null)).not.toThrow()
  })

  it('should be SSR-safe when window is undefined', () => {
    delete (globalThis as any).window
    expect(() => useDropZone(null)).not.toThrow()
  })

  it('should keep isOverDropZone true during dragover', () => {
    const el = createMockElement()
    const { isOverDropZone } = useDropZone(el)
    for (const h of el.__listeners['dragenter']) h({ preventDefault: () => {} } as any)
    for (const h of el.__listeners['dragover']) h({ preventDefault: () => {} } as any)
    expect(isOverDropZone.value).toBe(true)
  })
})
