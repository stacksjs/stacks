import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'

// ---------------------------------------------------------------------------
// Rely on the preload for @stacksjs/stx mock (functional reactive ref).
// Only dynamic imports used so the mock is applied first.
// ---------------------------------------------------------------------------

// Local ref helper for creating refs in test code
function ref<T>(initial: T) {
  let _value = initial
  const subscribers = new Set<(newVal: T, oldVal: T) => void>()
  return {
    get value() { return _value },
    set value(newVal: T) {
      const oldVal = _value
      _value = newVal
      for (const sub of subscribers) sub(newVal, oldVal)
    },
    subscribe(fn: (newVal: T, oldVal: T) => void) {
      subscribers.add(fn)
      return () => { subscribers.delete(fn) }
    },
  }
}

// Now import composables using dynamic import (to use mocked modules)
const { useClipboard } = await import('../src/useClipboard')
const { useMediaQuery } = await import('../src/useMediaQuery')
const { useBreakpoints, breakpointsTailwind, breakpointsBootstrap } = await import('../src/useBreakpoints')
const { useTitle } = await import('../src/useTitle')
const { useLocalStorage } = await import('../src/useLocalStorage')
const { useSessionStorage } = await import('../src/useSessionStorage')
const { useUrlSearchParams } = await import('../src/useUrlSearchParams')
const { useWindowSize } = await import('../src/useWindowSize')
const { useScroll } = await import('../src/useScroll')
const { useScrollLock } = await import('../src/useScrollLock')
const { useFullscreen } = await import('../src/useFullscreen')
const { onClickOutside } = await import('../src/onClickOutside')
const { onKeyStroke, onKeyDown, onKeyUp } = await import('../src/onKeyStroke')
const { useBrowserLocation } = await import('../src/useBrowserLocation')

// ---------------------------------------------------------------------------
// Global mock helpers
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

interface MockWindow {
  addEventListener: (type: string, listener: EventListenerOrEventListenerObject, opts?: any) => void
  removeEventListener: (type: string, listener: EventListenerOrEventListenerObject, opts?: any) => void
  dispatchEvent: (event: any) => boolean
  innerWidth: number
  innerHeight: number
  location: any
  history: any
  matchMedia: any
  __listeners: Record<string, Set<EventListener>>
}

function setupWindowMock(opts?: { innerWidth?: number, innerHeight?: number }): MockWindow {
  const listeners: Record<string, Set<EventListener>> = {}
  const locationState = {
    href: 'http://localhost:3000/test?existing=1',
    protocol: 'http:',
    host: 'localhost:3000',
    hostname: 'localhost',
    port: '3000',
    pathname: '/test',
    search: '?existing=1',
    hash: '',
    origin: 'http://localhost:3000',
  }
  const historyState: any[] = [null]
  const win: MockWindow = {
    addEventListener: (type: string, listener: EventListenerOrEventListenerObject, _opts?: any) => {
      if (!listeners[type]) listeners[type] = new Set()
      listeners[type].add(listener as EventListener)
    },
    removeEventListener: (type: string, listener: EventListenerOrEventListenerObject, _opts?: any) => {
      listeners[type]?.delete(listener as EventListener)
    },
    dispatchEvent: (event: any): boolean => {
      const handlers = listeners[event?.type]
      if (handlers) {
        for (const h of handlers) h(event)
      }
      return true
    },
    innerWidth: opts?.innerWidth ?? 1024,
    innerHeight: opts?.innerHeight ?? 768,
    location: locationState,
    history: {
      state: null,
      replaceState: (_state: any, _title: string, url?: string) => {
        if (url) {
          const parsed = new URL(url, 'http://localhost:3000')
          locationState.href = parsed.href
          locationState.pathname = parsed.pathname
          locationState.search = parsed.search
          locationState.hash = parsed.hash
        }
      },
      pushState: (_state: any, _title: string, url?: string) => {
        if (url) {
          const parsed = new URL(url, 'http://localhost:3000')
          locationState.href = parsed.href
          locationState.pathname = parsed.pathname
          locationState.search = parsed.search
          locationState.hash = parsed.hash
        }
      },
    },
    matchMedia: undefined as any,
    __listeners: listeners,
  }
  ;(globalThis as any).window = win
  return win
}

interface MockDocument {
  title: string
  body: any
  documentElement: any
  fullscreenEnabled: boolean
  fullscreenElement: any
  exitFullscreen: (() => Promise<void>) | null
  addEventListener: (type: string, listener: EventListenerOrEventListenerObject, opts?: any) => void
  removeEventListener: (type: string, listener: EventListenerOrEventListenerObject, opts?: any) => void
  __listeners: Record<string, Set<EventListener>>
}

function setupDocumentMock(): MockDocument {
  const listeners: Record<string, Set<EventListener>> = {}
  const bodyStyle: Record<string, string> = { overflow: '' }
  const doc: MockDocument = {
    title: '',
    body: {
      style: bodyStyle,
      appendChild: () => {},
      removeChild: () => {},
      contains: (node: any) => false,
      dispatchEvent: (event: any) => {
        const handlers = listeners[event?.type]
        if (handlers) {
          for (const h of handlers) h(event)
        }
        return true
      },
    },
    documentElement: {
      style: {},
      scrollHeight: 1000,
      scrollWidth: 1000,
      clientHeight: 768,
      clientWidth: 1024,
    },
    fullscreenEnabled: true,
    fullscreenElement: null,
    exitFullscreen: null,
    addEventListener: (type: string, listener: EventListenerOrEventListenerObject, _opts?: any) => {
      if (!listeners[type]) listeners[type] = new Set()
      listeners[type].add(listener as EventListener)
    },
    removeEventListener: (type: string, listener: EventListenerOrEventListenerObject, _opts?: any) => {
      listeners[type]?.delete(listener as EventListener)
    },
    __listeners: listeners,
  }
  ;(globalThis as any).document = doc
  return doc
}

function setupNavigatorMock(clipboardMock?: any) {
  const nav: any = {
    clipboard: clipboardMock ?? undefined,
  }
  ;(globalThis as any).navigator = nav
  return nav
}

function createMockElement(tag = 'div'): any {
  const listeners: Record<string, Set<EventListener>> = {}
  const children: any[] = []
  const el: any = {
    tagName: tag.toUpperCase(),
    style: { overflow: '' },
    contains: (node: any) => {
      if (node === el) return true
      return children.some(c => c === node || (c.contains && c.contains(node)))
    },
    appendChild: (child: any) => {
      children.push(child)
      child._parent = el
    },
    removeChild: (child: any) => {
      const idx = children.indexOf(child)
      if (idx >= 0) children.splice(idx, 1)
      child._parent = null
    },
    addEventListener: (type: string, listener: EventListenerOrEventListenerObject, _opts?: any) => {
      if (!listeners[type]) listeners[type] = new Set()
      listeners[type].add(listener as EventListener)
    },
    removeEventListener: (type: string, listener: EventListenerOrEventListenerObject, _opts?: any) => {
      listeners[type]?.delete(listener as EventListener)
    },
    dispatchEvent: (event: any): boolean => {
      const handlers = listeners[event?.type]
      if (handlers) {
        for (const h of handlers) h(event)
      }
      return true
    },
    requestFullscreen: null as any,
    scrollTop: 0,
    scrollLeft: 0,
    scrollHeight: 1000,
    scrollWidth: 1000,
    clientHeight: 500,
    clientWidth: 500,
    __listeners: listeners,
    __children: children,
  }
  return el
}

function createMockClipboard(opts?: { writeTextFail?: boolean }) {
  return {
    writeText: opts?.writeTextFail
      ? mock(() => Promise.reject(new Error('denied')))
      : mock(() => Promise.resolve()),
    readText: mock(() => Promise.resolve('')),
    read: mock(() => Promise.resolve([])),
    write: mock(() => Promise.resolve()),
  }
}

// ---------------------------------------------------------------------------
// Helpers: Mock Storage
// ---------------------------------------------------------------------------
function createMockStorage(): Storage {
  const store = new Map<string, string>()
  return {
    get length() { return store.size },
    clear() { store.clear() },
    getItem(key: string) { return store.get(key) ?? null },
    key(index: number) { return [...store.keys()][index] ?? null },
    removeItem(key: string) { store.delete(key) },
    setItem(key: string, value: string) { store.set(key, value) },
  }
}

// ===========================================================================
// TESTS
// ===========================================================================

// ---------------------------------------------------------------------------
// useClipboard
// ---------------------------------------------------------------------------
describe('useClipboard', () => {
  beforeEach(() => {
    saveGlobals()
    setupWindowMock()
  })
  afterEach(() => restoreGlobals())

  it('should detect clipboard support', () => {
    setupNavigatorMock(createMockClipboard())
    const { isSupported } = useClipboard()
    expect(isSupported.value).toBe(true)
  })

  it('should copy text to clipboard', async () => {
    const clipboard = createMockClipboard()
    setupNavigatorMock(clipboard)

    const { copy, text, copied } = useClipboard()
    await copy('hello world')

    expect(clipboard.writeText).toHaveBeenCalledWith('hello world')
    expect(text.value).toBe('hello world')
    expect(copied.value).toBe(true)
  })

  it('should reset copied after copiedDuring timeout', async () => {
    setupNavigatorMock(createMockClipboard())

    const { copy, copied } = useClipboard({ copiedDuring: 50 })
    await copy('test')

    expect(copied.value).toBe(true)
    await new Promise(r => setTimeout(r, 100))
    expect(copied.value).toBe(false)
  })

  it('should use source option if no text argument provided', async () => {
    const clipboard = createMockClipboard()
    setupNavigatorMock(clipboard)

    const { copy, text } = useClipboard({ source: 'source text' })
    await copy()

    expect(clipboard.writeText).toHaveBeenCalledWith('source text')
    expect(text.value).toBe('source text')
  })

  it('should accept a ref as source', async () => {
    const clipboard = createMockClipboard()
    setupNavigatorMock(clipboard)

    const source = ref('dynamic source')
    const { copy, text } = useClipboard({ source })
    await copy()

    expect(text.value).toBe('dynamic source')
  })

  it('should not copy when not supported', async () => {
    // Navigator without clipboard property
    ;(globalThis as any).navigator = {}

    const { copy, text, isSupported } = useClipboard()
    await copy('test')

    expect(isSupported.value).toBe(false)
    expect(text.value).toBe('')
  })

  it('should handle clipboard write failure gracefully', async () => {
    setupNavigatorMock(createMockClipboard({ writeTextFail: true }))

    const { copy, text, copied } = useClipboard()
    await copy('test')

    expect(text.value).toBe('')
    expect(copied.value).toBe(false)
  })

  it('should not copy when no text and no source given', async () => {
    const clipboard = createMockClipboard()
    setupNavigatorMock(clipboard)

    const { copy } = useClipboard()
    await copy()

    expect(clipboard.writeText).not.toHaveBeenCalled()
  })

  it('should default copiedDuring to 1500ms', () => {
    setupNavigatorMock(createMockClipboard())
    const { copied } = useClipboard()
    expect(copied.value).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// useMediaQuery
// ---------------------------------------------------------------------------
describe('useMediaQuery', () => {
  beforeEach(() => {
    saveGlobals()
  })
  afterEach(() => restoreGlobals())

  function setupMatchMedia(matchesFn: (query: string) => boolean) {
    const win = setupWindowMock()
    const changeHandlers = new Map<string, Set<(e: any) => void>>()
    win.matchMedia = (query: string) => {
      const handlers = new Set<(e: any) => void>()
      changeHandlers.set(query, handlers)
      return {
        matches: matchesFn(query),
        media: query,
        onchange: null,
        addEventListener: (_event: string, handler: any) => {
          handlers.add(handler)
        },
        removeEventListener: (_event: string, handler: any) => {
          handlers.delete(handler)
        },
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => true,
      }
    }
    return { win, changeHandlers }
  }

  it('should return false for non-matching query', () => {
    setupMatchMedia(() => false)
    const matches = useMediaQuery('(min-width: 9999px)')
    expect(matches.value).toBe(false)
  })

  it('should return true for matching query', () => {
    setupMatchMedia(() => true)
    const matches = useMediaQuery('(min-width: 0px)')
    expect(matches.value).toBe(true)
  })

  it('should respond to media query change events', () => {
    const { changeHandlers } = setupMatchMedia(() => false)
    const matches = useMediaQuery('(min-width: 768px)')
    expect(matches.value).toBe(false)

    // Simulate media query change
    const handlers = changeHandlers.get('(min-width: 768px)')
    if (handlers) {
      for (const h of handlers) h({ matches: true })
    }
    expect(matches.value).toBe(true)
  })

  it('should accept a ref as query', () => {
    setupMatchMedia((q) => q === '(min-width: 0px)')
    const queryRef = ref('(min-width: 0px)')
    const matches = useMediaQuery(queryRef)
    expect(matches.value).toBe(true)
  })

  it('should accept a getter as query', () => {
    setupMatchMedia((q) => q === '(max-width: 500px)')
    const matches = useMediaQuery(() => '(max-width: 500px)')
    expect(matches.value).toBe(true)
  })

  it('should handle matchMedia not available', () => {
    const win = setupWindowMock()
    win.matchMedia = undefined
    const matches = useMediaQuery('(min-width: 768px)')
    expect(matches.value).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// useBreakpoints
// ---------------------------------------------------------------------------
describe('useBreakpoints', () => {
  beforeEach(() => {
    saveGlobals()
  })
  afterEach(() => restoreGlobals())

  it('should provide greaterOrEqual correctly', () => {
    setupWindowMock({ innerWidth: 1024 })
    const bp = useBreakpoints(breakpointsTailwind)

    expect(bp.greaterOrEqual('sm').value).toBe(true)   // 1024 >= 640
    expect(bp.greaterOrEqual('md').value).toBe(true)   // 1024 >= 768
    expect(bp.greaterOrEqual('lg').value).toBe(true)   // 1024 >= 1024
    expect(bp.greaterOrEqual('xl').value).toBe(false)  // 1024 >= 1280
  })

  it('should provide smallerOrEqual correctly', () => {
    setupWindowMock({ innerWidth: 768 })
    const bp = useBreakpoints(breakpointsTailwind)

    expect(bp.smallerOrEqual('sm').value).toBe(false)  // 768 <= 640
    expect(bp.smallerOrEqual('md').value).toBe(true)   // 768 <= 768
    expect(bp.smallerOrEqual('lg').value).toBe(true)   // 768 <= 1024
  })

  it('should provide between correctly', () => {
    setupWindowMock({ innerWidth: 800 })
    const bp = useBreakpoints(breakpointsTailwind)

    expect(bp.between('md', 'lg').value).toBe(true)   // 800 >= 768 && 800 < 1024
    expect(bp.between('sm', 'md').value).toBe(false)  // 800 >= 640 && 800 < 768
    expect(bp.between('lg', 'xl').value).toBe(false)  // 800 >= 1024 && 800 < 1280
  })

  it('should provide isGreater correctly', () => {
    setupWindowMock({ innerWidth: 769 })
    const bp = useBreakpoints(breakpointsTailwind)

    expect(bp.isGreater('sm').value).toBe(true)   // 769 > 640
    expect(bp.isGreater('md').value).toBe(true)   // 769 > 768
    expect(bp.isGreater('lg').value).toBe(false)  // 769 > 1024
  })

  it('should provide isSmaller correctly', () => {
    setupWindowMock({ innerWidth: 500 })
    const bp = useBreakpoints(breakpointsTailwind)

    expect(bp.isSmaller('sm').value).toBe(true)  // 500 < 640
    expect(bp.isSmaller('md').value).toBe(true)  // 500 < 768
  })

  it('should return current active breakpoints', () => {
    setupWindowMock({ innerWidth: 1024 })
    const bp = useBreakpoints(breakpointsTailwind)
    const current = bp.current()

    expect(current.value).toContain('sm')
    expect(current.value).toContain('md')
    expect(current.value).toContain('lg')
    expect(current.value).not.toContain('xl')
    expect(current.value).not.toContain('2xl')
  })

  it('should work with Bootstrap breakpoints', () => {
    setupWindowMock({ innerWidth: 992 })
    const bp = useBreakpoints(breakpointsBootstrap)

    expect(bp.greaterOrEqual('sm').value).toBe(true)   // 992 >= 576
    expect(bp.greaterOrEqual('md').value).toBe(true)   // 992 >= 768
    expect(bp.greaterOrEqual('lg').value).toBe(true)   // 992 >= 992
    expect(bp.greaterOrEqual('xl').value).toBe(false)  // 992 >= 1200
  })

  it('should respond to resize events', () => {
    const win = setupWindowMock({ innerWidth: 500 })
    const bp = useBreakpoints(breakpointsTailwind)

    expect(bp.greaterOrEqual('sm').value).toBe(false)  // 500 < 640

    // Simulate resize
    win.innerWidth = 800
    win.dispatchEvent({ type: 'resize' })

    expect(bp.greaterOrEqual('sm').value).toBe(true)   // 800 >= 640
    expect(bp.greaterOrEqual('md').value).toBe(true)   // 800 >= 768
  })

  it('should work with custom breakpoints', () => {
    setupWindowMock({ innerWidth: 600 })
    const bp = useBreakpoints({
      mobile: 0,
      tablet: 600,
      desktop: 1200,
    })

    expect(bp.greaterOrEqual('mobile').value).toBe(true)
    expect(bp.greaterOrEqual('tablet').value).toBe(true)
    expect(bp.greaterOrEqual('desktop').value).toBe(false)
  })

  it('should return empty current when width is below all breakpoints', () => {
    setupWindowMock({ innerWidth: 100 })
    const bp = useBreakpoints(breakpointsTailwind)
    const current = bp.current()

    expect(current.value).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// useTitle
// ---------------------------------------------------------------------------
describe('useTitle', () => {
  beforeEach(() => {
    saveGlobals()
    setupWindowMock()
  })
  afterEach(() => restoreGlobals())

  it('should read current document title when no argument given', () => {
    const doc = setupDocumentMock()
    doc.title = 'Test Page'
    const title = useTitle()
    expect(title.value).toBe('Test Page')
  })

  it('should set document title with a string argument', () => {
    const doc = setupDocumentMock()
    const title = useTitle('New Title')
    expect(title.value).toBe('New Title')
    expect(doc.title).toBe('New Title')
  })

  it('should sync ref changes to document.title', () => {
    const doc = setupDocumentMock()
    const title = useTitle('Initial')
    expect(doc.title).toBe('Initial')

    title.value = 'Updated'
    expect(doc.title).toBe('Updated')
  })

  it('should accept a ref as argument', () => {
    const doc = setupDocumentMock()
    const titleRef = ref('Ref Title')
    const title = useTitle(titleRef)
    expect(title.value).toBe('Ref Title')
    expect(doc.title).toBe('Ref Title')
  })

  it('should accept a getter as argument', () => {
    const doc = setupDocumentMock()
    const title = useTitle(() => 'Getter Title')
    expect(title.value).toBe('Getter Title')
    expect(doc.title).toBe('Getter Title')
  })

  it('should handle empty string', () => {
    const doc = setupDocumentMock()
    const title = useTitle('')
    expect(title.value).toBe('')
    expect(doc.title).toBe('')
  })

  it('should update document when title ref value changes multiple times', () => {
    const doc = setupDocumentMock()
    const title = useTitle('First')
    expect(doc.title).toBe('First')

    title.value = 'Second'
    expect(doc.title).toBe('Second')

    title.value = 'Third'
    expect(doc.title).toBe('Third')
  })
})

// ---------------------------------------------------------------------------
// useLocalStorage
// ---------------------------------------------------------------------------
describe('useLocalStorage', () => {
  let mockStorage: Storage

  beforeEach(() => {
    saveGlobals()
    setupWindowMock()
    mockStorage = createMockStorage()
    ;(globalThis as any).localStorage = mockStorage
  })

  afterEach(() => {
    mockStorage.clear()
    restoreGlobals()
  })

  it('should return default value when key does not exist', () => {
    const data = useLocalStorage('test-key', 'default')
    expect(data.value).toBe('default')
  })

  it('should read existing value from localStorage', () => {
    mockStorage.setItem('test-key', JSON.stringify('stored-value'))
    const data = useLocalStorage('test-key', 'default')
    expect(data.value).toBe('stored-value')
  })

  it('should write changes back to localStorage', () => {
    const data = useLocalStorage('test-key', 'initial')
    data.value = 'updated'
    expect(JSON.parse(mockStorage.getItem('test-key')!)).toBe('updated')
  })

  it('should handle object values', () => {
    const data = useLocalStorage('obj-key', { name: 'test', count: 0 })
    expect(data.value).toEqual({ name: 'test', count: 0 })

    data.value = { name: 'updated', count: 1 }
    const stored = JSON.parse(mockStorage.getItem('obj-key')!)
    expect(stored).toEqual({ name: 'updated', count: 1 })
  })

  it('should handle array values', () => {
    const data = useLocalStorage('arr-key', [1, 2, 3])
    expect(data.value).toEqual([1, 2, 3])

    data.value = [4, 5, 6]
    expect(JSON.parse(mockStorage.getItem('arr-key')!)).toEqual([4, 5, 6])
  })

  it('should handle number values', () => {
    const data = useLocalStorage('num-key', 42)
    expect(data.value).toBe(42)

    data.value = 100
    expect(JSON.parse(mockStorage.getItem('num-key')!)).toBe(100)
  })

  it('should handle boolean values', () => {
    const data = useLocalStorage('bool-key', true)
    expect(data.value).toBe(true)

    data.value = false
    expect(JSON.parse(mockStorage.getItem('bool-key')!)).toBe(false)
  })

  it('should use custom serializer', () => {
    const data = useLocalStorage('custom-key', 'hello', {
      serializer: {
        read: (raw: string) => raw.toUpperCase(),
        write: (value: string) => value.toLowerCase(),
      },
    })
    expect(data.value).toBe('hello')

    data.value = 'WORLD'
    expect(mockStorage.getItem('custom-key')).toBe('world')
  })

  it('should remove item when set to null', () => {
    mockStorage.setItem('null-key', JSON.stringify('value'))
    const data = useLocalStorage<string | null>('null-key', 'default')
    expect(data.value).toBe('value')

    data.value = null
    expect(mockStorage.getItem('null-key')).toBeNull()
  })

  it('should handle pre-existing non-JSON values gracefully', () => {
    mockStorage.setItem('raw-key', 'just a string')
    const data = useLocalStorage('raw-key', 'default')
    expect(data.value).toBe('just a string')
  })
})

// ---------------------------------------------------------------------------
// useSessionStorage
// ---------------------------------------------------------------------------
describe('useSessionStorage', () => {
  let mockStorage: Storage

  beforeEach(() => {
    saveGlobals()
    setupWindowMock()
    mockStorage = createMockStorage()
    ;(globalThis as any).sessionStorage = mockStorage
  })

  afterEach(() => {
    mockStorage.clear()
    restoreGlobals()
  })

  it('should return default value when key does not exist', () => {
    const data = useSessionStorage('sess-key', 'default')
    expect(data.value).toBe('default')
  })

  it('should read existing value from sessionStorage', () => {
    mockStorage.setItem('sess-key', JSON.stringify('stored'))
    const data = useSessionStorage('sess-key', 'default')
    expect(data.value).toBe('stored')
  })

  it('should write changes back to sessionStorage', () => {
    const data = useSessionStorage('sess-key', 'initial')
    data.value = 'updated'
    expect(JSON.parse(mockStorage.getItem('sess-key')!)).toBe('updated')
  })

  it('should handle object values', () => {
    const data = useSessionStorage('sess-obj', { a: 1 })
    data.value = { a: 2 }
    expect(JSON.parse(mockStorage.getItem('sess-obj')!)).toEqual({ a: 2 })
  })

  it('should handle number values', () => {
    const data = useSessionStorage('sess-num', 0)
    data.value = 99
    expect(JSON.parse(mockStorage.getItem('sess-num')!)).toBe(99)
  })

  it('should use custom serializer', () => {
    const data = useSessionStorage('sess-custom', 10, {
      serializer: {
        read: (raw: string) => Number.parseInt(raw, 10) * 2,
        write: (value: number) => String(value / 2),
      },
    })
    data.value = 20
    expect(mockStorage.getItem('sess-custom')).toBe('10')
  })

  it('should remove item when value set to null', () => {
    mockStorage.setItem('sess-null', JSON.stringify('value'))
    const data = useSessionStorage<string | null>('sess-null', 'default')
    data.value = null
    expect(mockStorage.getItem('sess-null')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// useUrlSearchParams
// ---------------------------------------------------------------------------
describe('useUrlSearchParams', () => {
  beforeEach(() => {
    saveGlobals()
  })
  afterEach(() => restoreGlobals())

  it('should return empty params for clean URL', () => {
    const win = setupWindowMock()
    win.location.search = ''
    win.location.pathname = '/'
    const { params, get } = useUrlSearchParams('history')
    expect(typeof params.value).toBe('object')
    expect(typeof get).toBe('function')
  })

  it('should provide get/set/delete methods', () => {
    setupWindowMock()
    const result = useUrlSearchParams('history')
    expect(typeof result.get).toBe('function')
    expect(typeof result.set).toBe('function')
    expect(typeof result.delete).toBe('function')
    expect(result.params).toBeDefined()
  })

  it('should set a param value', () => {
    const win = setupWindowMock()
    win.location.search = ''
    win.location.pathname = '/'
    const { set, get, params } = useUrlSearchParams('history')
    set('foo', 'bar')
    expect(get('foo')).toBe('bar')
    expect(params.value.foo).toBe('bar')
  })

  it('should delete a param value', () => {
    const win = setupWindowMock()
    win.location.search = ''
    win.location.pathname = '/'
    const result = useUrlSearchParams('history')
    result.set('key', 'value')
    expect(result.get('key')).toBe('value')

    result.delete('key')
    expect(result.get('key')).toBeNull()
  })

  it('should return null for non-existing param', () => {
    setupWindowMock()
    const { get } = useUrlSearchParams('history')
    expect(get('nonexistent')).toBeNull()
  })

  it('should accept initial values', () => {
    const win = setupWindowMock()
    win.location.search = ''
    win.location.pathname = '/'
    const { params } = useUrlSearchParams('history', {
      initialValue: { foo: 'bar' },
    })
    expect(params.value.foo).toBe('bar')
  })

  it('should work in hash mode', () => {
    const win = setupWindowMock()
    win.location.hash = '#'
    win.location.search = ''
    win.location.pathname = '/'
    const { set, get } = useUrlSearchParams('hash')
    set('hashKey', 'hashValue')
    expect(get('hashKey')).toBe('hashValue')
  })

  it('should override multiple params', () => {
    const win = setupWindowMock()
    win.location.search = ''
    win.location.pathname = '/'
    const { set, get } = useUrlSearchParams('history')
    set('a', '1')
    set('b', '2')
    set('c', '3')

    expect(get('a')).toBe('1')
    expect(get('b')).toBe('2')
    expect(get('c')).toBe('3')
  })
})

// ---------------------------------------------------------------------------
// useWindowSize
// ---------------------------------------------------------------------------
describe('useWindowSize', () => {
  beforeEach(() => {
    saveGlobals()
  })
  afterEach(() => restoreGlobals())

  it('should return current window dimensions', () => {
    setupWindowMock({ innerWidth: 1024, innerHeight: 768 })
    const { width, height } = useWindowSize()
    expect(width.value).toBe(1024)
    expect(height.value).toBe(768)
  })

  it('should update on resize', () => {
    const win = setupWindowMock({ innerWidth: 1024, innerHeight: 768 })
    const { width, height } = useWindowSize()

    win.innerWidth = 1920
    win.innerHeight = 1080
    win.dispatchEvent({ type: 'resize' })

    expect(width.value).toBe(1920)
    expect(height.value).toBe(1080)
  })

  it('should use initial values for SSR context', () => {
    // No window
    const { width, height } = useWindowSize({
      initialWidth: 1024,
      initialHeight: 768,
    })

    expect(width.value).toBe(1024)
    expect(height.value).toBe(768)
  })

  it('should respond to orientation change', () => {
    const win = setupWindowMock({ innerWidth: 1024, innerHeight: 768 })
    const { width, height } = useWindowSize({ listenOrientation: true })

    win.innerWidth = 768
    win.innerHeight = 1024
    win.dispatchEvent({ type: 'orientationchange' })

    expect(width.value).toBe(768)
    expect(height.value).toBe(1024)
  })

  it('should return numeric refs', () => {
    setupWindowMock()
    const { width, height } = useWindowSize()
    expect(typeof width.value).toBe('number')
    expect(typeof height.value).toBe('number')
  })

  it('should not listen to orientation when disabled', () => {
    const win = setupWindowMock({ innerWidth: 1024 })
    const { width } = useWindowSize({ listenOrientation: false })
    const initialWidth = width.value

    win.innerWidth = 500
    win.dispatchEvent({ type: 'orientationchange' })

    // Should NOT update since listenOrientation is false
    expect(width.value).toBe(initialWidth)
  })

  it('should handle multiple resize events', () => {
    const win = setupWindowMock()
    const { width } = useWindowSize()

    win.innerWidth = 100
    win.dispatchEvent({ type: 'resize' })
    expect(width.value).toBe(100)

    win.innerWidth = 200
    win.dispatchEvent({ type: 'resize' })
    expect(width.value).toBe(200)

    win.innerWidth = 300
    win.dispatchEvent({ type: 'resize' })
    expect(width.value).toBe(300)
  })
})

// ---------------------------------------------------------------------------
// useScroll
// ---------------------------------------------------------------------------
describe('useScroll', () => {
  beforeEach(() => {
    saveGlobals()
    const win = setupWindowMock()
    // Add scroll-related properties to mock window
    ;(win as any).scrollX = 0
    ;(win as any).scrollY = 0
    ;(win as any).pageXOffset = 0
    ;(win as any).pageYOffset = 0
    setupDocumentMock()
  })
  afterEach(() => restoreGlobals())

  it('should return initial scroll position of zero', () => {
    const { x, y } = useScroll()
    expect(typeof x.value).toBe('number')
    expect(typeof y.value).toBe('number')
  })

  it('should have boolean isScrolling ref', () => {
    const { isScrolling } = useScroll()
    expect(isScrolling.value).toBe(false)
  })

  it('should provide arrivedState with all directions', () => {
    const { arrivedState } = useScroll()
    expect(arrivedState.top).toBeDefined()
    expect(arrivedState.bottom).toBeDefined()
    expect(arrivedState.left).toBeDefined()
    expect(arrivedState.right).toBeDefined()
  })

  it('should provide directions with all values', () => {
    const { directions } = useScroll()
    expect(directions.top).toBeDefined()
    expect(directions.bottom).toBeDefined()
    expect(directions.left).toBeDefined()
    expect(directions.right).toBeDefined()
  })

  it('should track scroll on a custom element', () => {
    const el = createMockElement()
    const { x, y } = useScroll(el)
    expect(typeof x.value).toBe('number')
    expect(typeof y.value).toBe('number')
  })

  it('should initially be arrived at top and left', () => {
    const { arrivedState } = useScroll()
    expect(arrivedState.top.value).toBe(true)
    expect(arrivedState.left.value).toBe(true)
  })

  it('should accept throttle option', () => {
    const { x, y } = useScroll(undefined, { throttle: 100 })
    expect(typeof x.value).toBe('number')
    expect(typeof y.value).toBe('number')
  })

  it('should accept offset options', () => {
    const { arrivedState } = useScroll(undefined, {
      offset: { top: 10, bottom: 10, left: 10, right: 10 },
    })
    expect(arrivedState.top).toBeDefined()
  })

  it('should default all direction flags to false', () => {
    const { directions } = useScroll()
    expect(directions.top.value).toBe(false)
    expect(directions.bottom.value).toBe(false)
    expect(directions.left.value).toBe(false)
    expect(directions.right.value).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// useScrollLock
// ---------------------------------------------------------------------------
describe('useScrollLock', () => {
  beforeEach(() => {
    saveGlobals()
    setupWindowMock()
  })
  afterEach(() => restoreGlobals())

  it('should return false initially', () => {
    setupDocumentMock()
    const isLocked = useScrollLock()
    expect(isLocked.value).toBe(false)
  })

  it('should lock body scroll when set to true', () => {
    const doc = setupDocumentMock()
    doc.body.style.overflow = ''
    const isLocked = useScrollLock()
    isLocked.value = true
    expect(doc.body.style.overflow).toBe('hidden')
  })

  it('should unlock body scroll when set to false', () => {
    const doc = setupDocumentMock()
    const isLocked = useScrollLock()
    isLocked.value = true
    expect(doc.body.style.overflow).toBe('hidden')

    isLocked.value = false
    expect(doc.body.style.overflow).toBe('')
  })

  it('should restore original overflow value on unlock', () => {
    const doc = setupDocumentMock()
    doc.body.style.overflow = 'auto'
    const isLocked = useScrollLock()
    isLocked.value = true
    expect(doc.body.style.overflow).toBe('hidden')

    isLocked.value = false
    expect(doc.body.style.overflow).toBe('auto')
  })

  it('should work with custom element', () => {
    setupDocumentMock()
    const el = createMockElement()
    el.style.overflow = 'scroll'
    const isLocked = useScrollLock(el)

    isLocked.value = true
    expect(el.style.overflow).toBe('hidden')

    isLocked.value = false
    expect(el.style.overflow).toBe('scroll')
  })

  it('should accept a ref element', () => {
    setupDocumentMock()
    const el = createMockElement()
    const elRef = ref(el)
    const isLocked = useScrollLock(elRef)

    isLocked.value = true
    expect(el.style.overflow).toBe('hidden')
  })

  it('should handle toggling multiple times', () => {
    setupDocumentMock()
    const el = createMockElement()
    el.style.overflow = ''
    const isLocked = useScrollLock(el)

    isLocked.value = true
    expect(el.style.overflow).toBe('hidden')

    isLocked.value = false
    expect(el.style.overflow).toBe('')

    isLocked.value = true
    expect(el.style.overflow).toBe('hidden')

    isLocked.value = false
    expect(el.style.overflow).toBe('')
  })
})

// ---------------------------------------------------------------------------
// useFullscreen
// ---------------------------------------------------------------------------
describe('useFullscreen', () => {
  beforeEach(() => {
    saveGlobals()
    setupWindowMock()
  })
  afterEach(() => restoreGlobals())

  it('should return isFullscreen as false initially', () => {
    setupDocumentMock()
    const { isFullscreen } = useFullscreen()
    expect(isFullscreen.value).toBe(false)
  })

  it('should detect fullscreen support', () => {
    setupDocumentMock()
    const { isSupported } = useFullscreen()
    expect(typeof isSupported.value).toBe('boolean')
  })

  it('should provide enter, exit, and toggle functions', () => {
    setupDocumentMock()
    const { enter, exit, toggle } = useFullscreen()
    expect(typeof enter).toBe('function')
    expect(typeof exit).toBe('function')
    expect(typeof toggle).toBe('function')
  })

  it('should call requestFullscreen on enter', async () => {
    setupDocumentMock()
    const el = createMockElement()
    el.requestFullscreen = mock(() => Promise.resolve())

    const { enter } = useFullscreen(el)
    await enter()

    expect(el.requestFullscreen).toHaveBeenCalled()
  })

  it('should call exitFullscreen on exit', async () => {
    const doc = setupDocumentMock()
    doc.exitFullscreen = mock(() => Promise.resolve()) as any

    const { exit } = useFullscreen()
    await exit()

    expect(doc.exitFullscreen).toHaveBeenCalled()
  })

  it('should toggle fullscreen state', async () => {
    setupDocumentMock()
    const el = createMockElement()
    el.requestFullscreen = mock(() => Promise.resolve())

    const { toggle } = useFullscreen(el)

    // Initially not fullscreen, toggle should enter
    await toggle()
    expect(el.requestFullscreen).toHaveBeenCalled()
  })

  it('should handle enter failure gracefully', async () => {
    setupDocumentMock()
    const el = createMockElement()
    el.requestFullscreen = mock(() => Promise.reject(new Error('denied')))

    const { enter, isFullscreen } = useFullscreen(el)
    await enter()  // Should not throw
    expect(typeof isFullscreen.value).toBe('boolean')
  })

  it('should accept a ref element', () => {
    setupDocumentMock()
    const el = createMockElement()
    const elRef = ref(el)
    const { isFullscreen } = useFullscreen(elRef)
    expect(isFullscreen.value).toBe(false)
  })

  it('should work with no target (uses documentElement)', () => {
    setupDocumentMock()
    const { isFullscreen, isSupported } = useFullscreen()
    expect(typeof isFullscreen.value).toBe('boolean')
    expect(typeof isSupported.value).toBe('boolean')
  })
})

// ---------------------------------------------------------------------------
// onClickOutside
// ---------------------------------------------------------------------------
describe('onClickOutside', () => {
  beforeEach(() => {
    saveGlobals()
  })
  afterEach(() => restoreGlobals())

  it('should call handler when clicking outside target', () => {
    const win = setupWindowMock()
    const target = createMockElement()

    const handler = mock(() => {})
    onClickOutside(target, handler)

    // Simulate click outside - event target is not target element
    const event = { type: 'pointerdown', target: createMockElement(), composedPath: () => [] }
    for (const h of win.__listeners['pointerdown']) h(event as any)

    expect(handler).toHaveBeenCalled()
  })

  it('should NOT call handler when clicking inside target', () => {
    const win = setupWindowMock()
    const target = createMockElement()

    const handler = mock(() => {})
    onClickOutside(target, handler)

    // Simulate click on target itself
    const event = { type: 'pointerdown', target, composedPath: () => [target] }
    for (const h of win.__listeners['pointerdown']) h(event as any)

    expect(handler).not.toHaveBeenCalled()
  })

  it('should return a cleanup function', () => {
    setupWindowMock()
    const target = createMockElement()
    const handler = mock(() => {})
    const cleanup = onClickOutside(target, handler)
    expect(typeof cleanup).toBe('function')
  })

  it('should stop listening after cleanup', () => {
    const win = setupWindowMock()
    const target = createMockElement()

    const handler = mock(() => {})
    const cleanup = onClickOutside(target, handler)
    cleanup()

    const event = { type: 'pointerdown', target: createMockElement(), composedPath: () => [] }
    for (const h of (win.__listeners['pointerdown'] ?? [])) h(event as any)

    expect(handler).not.toHaveBeenCalled()
  })

  it('should ignore clicks on ignored elements', () => {
    const win = setupWindowMock()
    const target = createMockElement()
    const ignored = createMockElement()

    const handler = mock(() => {})
    onClickOutside(target, handler, { ignore: [ignored] })

    // Click on ignored element
    const event = { type: 'pointerdown', target: ignored, composedPath: () => [ignored] }
    for (const h of win.__listeners['pointerdown']) h(event as any)

    expect(handler).not.toHaveBeenCalled()
  })

  it('should handle null target gracefully', () => {
    setupWindowMock()
    const handler = mock(() => {})
    const cleanup = onClickOutside(null, handler)
    expect(typeof cleanup).toBe('function')
  })

  it('should accept ref as target', () => {
    const win = setupWindowMock()
    const el = createMockElement()
    const targetRef = ref(el)

    const handler = mock(() => {})
    onClickOutside(targetRef, handler)

    // Click outside
    const event = { type: 'pointerdown', target: createMockElement(), composedPath: () => [] }
    for (const h of win.__listeners['pointerdown']) h(event as any)

    expect(handler).toHaveBeenCalled()
  })

  it('should handle child element clicks as inside', () => {
    const win = setupWindowMock()
    const target = createMockElement()
    const child = createMockElement('span')
    target.appendChild(child)

    const handler = mock(() => {})
    onClickOutside(target, handler)

    // Click on child - target.contains(child) returns true
    const event = { type: 'pointerdown', target: child, composedPath: () => [child, target] }
    for (const h of win.__listeners['pointerdown']) h(event as any)

    expect(handler).not.toHaveBeenCalled()
  })

  it('should pass the mouse event to handler', () => {
    const win = setupWindowMock()
    const target = createMockElement()

    let receivedEvent: any = null
    onClickOutside(target, (event) => {
      receivedEvent = event
    })

    const event = { type: 'pointerdown', target: createMockElement(), composedPath: () => [] }
    for (const h of win.__listeners['pointerdown']) h(event as any)

    expect(receivedEvent).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// onKeyStroke
// ---------------------------------------------------------------------------
describe('onKeyStroke', () => {
  beforeEach(() => {
    saveGlobals()
  })
  afterEach(() => restoreGlobals())

  it('should call handler for matching key', () => {
    const win = setupWindowMock()
    const handler = mock(() => {})
    onKeyStroke('Enter', handler)

    const event = { type: 'keydown', key: 'Enter' }
    for (const h of win.__listeners['keydown']) h(event as any)

    expect(handler).toHaveBeenCalled()
  })

  it('should not call handler for non-matching key', () => {
    const win = setupWindowMock()
    const handler = mock(() => {})
    const cleanup = onKeyStroke('Enter', handler)

    const event = { type: 'keydown', key: 'Escape' }
    for (const h of win.__listeners['keydown']) h(event as any)

    expect(handler).not.toHaveBeenCalled()
    cleanup()
  })

  it('should support array of keys', () => {
    const win = setupWindowMock()
    const handler = mock(() => {})
    const cleanup = onKeyStroke(['a', 'b', 'c'], handler)

    for (const h of win.__listeners['keydown']) h({ type: 'keydown', key: 'a' } as any)
    expect(handler).toHaveBeenCalledTimes(1)

    for (const h of win.__listeners['keydown']) h({ type: 'keydown', key: 'b' } as any)
    expect(handler).toHaveBeenCalledTimes(2)

    for (const h of win.__listeners['keydown']) h({ type: 'keydown', key: 'd' } as any)
    expect(handler).toHaveBeenCalledTimes(2)

    cleanup()
  })

  it('should support filter function', () => {
    const win = setupWindowMock()
    const handler = mock(() => {})
    const cleanup = onKeyStroke(
      (e: KeyboardEvent) => e.key === 'a' && e.ctrlKey,
      handler,
    )

    for (const h of win.__listeners['keydown']) h({ type: 'keydown', key: 'a', ctrlKey: false } as any)
    expect(handler).not.toHaveBeenCalled()

    for (const h of win.__listeners['keydown']) h({ type: 'keydown', key: 'a', ctrlKey: true } as any)
    expect(handler).toHaveBeenCalledTimes(1)

    cleanup()
  })

  it('should support keyup event', () => {
    const win = setupWindowMock()
    const handler = mock(() => {})
    const cleanup = onKeyStroke('Space', handler, { eventName: 'keyup' })

    // keydown should not trigger
    expect(win.__listeners['keydown']).toBeUndefined()

    for (const h of win.__listeners['keyup']) h({ type: 'keyup', key: 'Space' } as any)
    expect(handler).toHaveBeenCalledTimes(1)

    cleanup()
  })

  it('should return cleanup function', () => {
    const win = setupWindowMock()
    const handler = mock(() => {})
    const cleanup = onKeyStroke('Enter', handler)
    expect(typeof cleanup).toBe('function')

    cleanup()

    // After cleanup, handler should not be called
    for (const h of (win.__listeners['keydown'] ?? [])) h({ type: 'keydown', key: 'Enter' } as any)
    expect(handler).not.toHaveBeenCalled()
  })

  it('should support custom target element', () => {
    const win = setupWindowMock()
    const el = createMockElement('input')

    const handler = mock(() => {})
    const cleanup = onKeyStroke('Enter', handler, { target: el })

    // Fire on window - should not trigger (handler is on el, not window)
    for (const h of (win.__listeners['keydown'] ?? [])) h({ type: 'keydown', key: 'Enter' } as any)
    expect(handler).not.toHaveBeenCalled()

    // Fire on element - should trigger
    for (const h of el.__listeners['keydown']) h({ type: 'keydown', key: 'Enter' } as any)
    expect(handler).toHaveBeenCalledTimes(1)

    cleanup()
  })

  it('onKeyDown should be alias for keydown', () => {
    const win = setupWindowMock()
    const handler = mock(() => {})
    const cleanup = onKeyDown('Escape', handler)

    for (const h of win.__listeners['keydown']) h({ type: 'keydown', key: 'Escape' } as any)
    expect(handler).toHaveBeenCalledTimes(1)

    cleanup()
  })

  it('onKeyUp should be alias for keyup', () => {
    const win = setupWindowMock()
    const handler = mock(() => {})
    const cleanup = onKeyUp('Escape', handler)

    // keydown should not exist for this listener
    for (const h of (win.__listeners['keydown'] ?? [])) h({ type: 'keydown', key: 'Escape' } as any)
    expect(handler).not.toHaveBeenCalled()

    for (const h of win.__listeners['keyup']) h({ type: 'keyup', key: 'Escape' } as any)
    expect(handler).toHaveBeenCalledTimes(1)

    cleanup()
  })

  it('should pass the keyboard event to handler', () => {
    const win = setupWindowMock()
    let receivedEvent: any = null
    const cleanup = onKeyStroke('Enter', (e) => {
      receivedEvent = e
    })

    const event = { type: 'keydown', key: 'Enter' }
    for (const h of win.__listeners['keydown']) h(event as any)
    expect(receivedEvent).not.toBeNull()
    expect(receivedEvent.key).toBe('Enter')

    cleanup()
  })
})

// ---------------------------------------------------------------------------
// useBrowserLocation
// ---------------------------------------------------------------------------
describe('useBrowserLocation', () => {
  beforeEach(() => {
    saveGlobals()
  })
  afterEach(() => restoreGlobals())

  it('should return all location properties', () => {
    setupWindowMock()
    const loc = useBrowserLocation()
    expect(loc.href).toBeDefined()
    expect(loc.protocol).toBeDefined()
    expect(loc.host).toBeDefined()
    expect(loc.hostname).toBeDefined()
    expect(loc.port).toBeDefined()
    expect(loc.pathname).toBeDefined()
    expect(loc.search).toBeDefined()
    expect(loc.hash).toBeDefined()
    expect(loc.origin).toBeDefined()
  })

  it('should read current location href', () => {
    setupWindowMock()
    const { href } = useBrowserLocation()
    expect(typeof href.value).toBe('string')
    expect(href.value.length).toBeGreaterThan(0)
  })

  it('should read current protocol', () => {
    setupWindowMock()
    const { protocol } = useBrowserLocation()
    expect(typeof protocol.value).toBe('string')
    expect(protocol.value.endsWith(':')).toBe(true)
  })

  it('should read current pathname', () => {
    setupWindowMock()
    const { pathname } = useBrowserLocation()
    expect(typeof pathname.value).toBe('string')
    expect(pathname.value.startsWith('/')).toBe(true)
  })

  it('should read current hostname', () => {
    setupWindowMock()
    const { hostname } = useBrowserLocation()
    expect(typeof hostname.value).toBe('string')
  })

  it('should provide string values for all refs', () => {
    setupWindowMock()
    const loc = useBrowserLocation()
    expect(typeof loc.href.value).toBe('string')
    expect(typeof loc.protocol.value).toBe('string')
    expect(typeof loc.host.value).toBe('string')
    expect(typeof loc.hostname.value).toBe('string')
    expect(typeof loc.port.value).toBe('string')
    expect(typeof loc.pathname.value).toBe('string')
    expect(typeof loc.search.value).toBe('string')
    expect(typeof loc.hash.value).toBe('string')
    expect(typeof loc.origin.value).toBe('string')
  })

  it('should update on popstate events', () => {
    const win = setupWindowMock()
    const { pathname } = useBrowserLocation()

    // Change location and fire popstate
    win.location.pathname = '/new-path'
    win.dispatchEvent({ type: 'popstate' })
    expect(pathname.value).toBe('/new-path')
  })

  it('should update on hashchange events', () => {
    const win = setupWindowMock()
    const { hash } = useBrowserLocation()

    win.location.hash = '#section'
    win.dispatchEvent({ type: 'hashchange' })
    expect(hash.value).toBe('#section')
  })

  it('should reflect current origin', () => {
    setupWindowMock()
    const { origin } = useBrowserLocation()
    expect(origin.value).toBe('http://localhost:3000')
  })
})
