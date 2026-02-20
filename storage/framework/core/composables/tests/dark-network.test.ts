import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'

// ---------------------------------------------------------------------------
//  Rely on the preload for @stacksjs/stx mock (functional reactive ref).
//  Only dynamic imports used so the mock is applied first.
// ---------------------------------------------------------------------------

const { usePreferredDark, useDark } = await import('../src/useDark')
const { useColorMode } = await import('../src/useColorMode')
const { useNetwork } = await import('../src/useNetwork')
const { useOnline } = await import('../src/useOnline')
const { useToggle } = await import('../src/useToggle')

// ---------------------------------------------------------------------------
//  Save and restore globals between tests
// ---------------------------------------------------------------------------
let savedWindow: any
let savedDocument: any
let savedNavigator: any
let savedLocalStorage: any

function saveGlobals() {
  savedWindow = (globalThis as any).window
  savedDocument = (globalThis as any).document
  savedNavigator = (globalThis as any).navigator
  savedLocalStorage = (globalThis as any).localStorage
}

function restoreGlobals() {
  if (savedWindow !== undefined) (globalThis as any).window = savedWindow
  else delete (globalThis as any).window
  if (savedDocument !== undefined) (globalThis as any).document = savedDocument
  else delete (globalThis as any).document
  if (savedNavigator !== undefined) (globalThis as any).navigator = savedNavigator
  else delete (globalThis as any).navigator
  if (savedLocalStorage !== undefined) (globalThis as any).localStorage = savedLocalStorage
  else delete (globalThis as any).localStorage
}

// ---------------------------------------------------------------------------
//  Mock browser environment helpers
// ---------------------------------------------------------------------------
function setupWindowMock(opts?: { matchMedia?: any }): any {
  const listeners: Record<string, Set<Function>> = {}
  const win: any = {
    addEventListener: (t: string, fn: Function) => {
      if (!listeners[t]) listeners[t] = new Set()
      listeners[t].add(fn)
    },
    removeEventListener: (t: string, fn: Function) => {
      listeners[t]?.delete(fn)
    },
    dispatchEvent: (e: any) => {
      for (const h of (listeners[e?.type] ?? [])) h(e)
      return true
    },
    matchMedia: opts?.matchMedia,
    __listeners: listeners,
  }
  ;(globalThis as any).window = win
  return win
}

function setupDocumentMock(): any {
  const classes = new Set<string>()
  const doc: any = {
    documentElement: {
      classList: {
        add: (c: string) => classes.add(c),
        remove: (c: string) => classes.delete(c),
        toggle: (c: string, force?: boolean) => {
          if (force) classes.add(c)
          else classes.delete(c)
        },
        contains: (c: string) => classes.has(c),
      },
      setAttribute: (attr: string, val: string) => {
        doc.documentElement[`_${attr}`] = val
      },
      getAttribute: (attr: string) => doc.documentElement[`_${attr}`] ?? null,
      querySelector: () => null,
    },
    querySelector: (sel: string) => sel === 'html' ? doc.documentElement : null,
  }
  ;(globalThis as any).document = doc
  return doc
}

function setupLocalStorageMock(): any {
  const store = new Map<string, string>()
  const ls = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
    _store: store,
  }
  ;(globalThis as any).localStorage = ls
  return ls
}

function setupNavigatorMock(opts?: { onLine?: boolean, connection?: any }): any {
  const nav: any = {
    onLine: opts?.onLine ?? true,
  }
  if (opts?.connection !== undefined) {
    nav.connection = opts.connection
  }
  ;(globalThis as any).navigator = nav
  return nav
}

/**
 * Creates a matchMedia mock that returns a controlled MediaQueryList.
 * The returned object has a _trigger(matches) method to simulate change events.
 */
function createMatchMediaMock(initialMatches: boolean) {
  const changeListeners = new Set<Function>()
  const mql: any = {
    matches: initialMatches,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (type: string, fn: Function) => {
      if (type === 'change') changeListeners.add(fn)
    },
    removeEventListener: (type: string, fn: Function) => {
      if (type === 'change') changeListeners.delete(fn)
    },
    _trigger: (matches: boolean) => {
      mql.matches = matches
      for (const fn of changeListeners) fn({ matches })
    },
    _listeners: changeListeners,
  }

  const matchMediaFn = (_query: string) => mql
  return { matchMediaFn, mql }
}

// ==========================================================================
//  usePreferredDark
// ==========================================================================
describe('usePreferredDark', () => {
  beforeEach(() => saveGlobals())
  afterEach(() => restoreGlobals())

  it('should return false when OS is light mode', () => {
    const { matchMediaFn } = createMatchMediaMock(false)
    setupWindowMock({ matchMedia: matchMediaFn })
    const matches = usePreferredDark()
    expect(matches.value).toBe(false)
  })

  it('should return true when OS is dark mode', () => {
    const { matchMediaFn } = createMatchMediaMock(true)
    setupWindowMock({ matchMedia: matchMediaFn })
    const matches = usePreferredDark()
    expect(matches.value).toBe(true)
  })

  it('should update when matchMedia change event fires', () => {
    const { matchMediaFn, mql } = createMatchMediaMock(false)
    setupWindowMock({ matchMedia: matchMediaFn })
    const matches = usePreferredDark()
    expect(matches.value).toBe(false)
    mql._trigger(true)
    expect(matches.value).toBe(true)
  })

  it('should be SSR-safe and return false when no window', () => {
    delete (globalThis as any).window
    const matches = usePreferredDark()
    expect(matches.value).toBe(false)
  })

  it('should handle missing matchMedia gracefully', () => {
    setupWindowMock({ matchMedia: undefined })
    const matches = usePreferredDark()
    expect(matches.value).toBe(false)
  })

  it('should handle multiple change events correctly', () => {
    const { matchMediaFn, mql } = createMatchMediaMock(false)
    setupWindowMock({ matchMedia: matchMediaFn })
    const matches = usePreferredDark()
    expect(matches.value).toBe(false)
    mql._trigger(true)
    expect(matches.value).toBe(true)
    mql._trigger(false)
    expect(matches.value).toBe(false)
    mql._trigger(true)
    expect(matches.value).toBe(true)
    mql._trigger(true)
    expect(matches.value).toBe(true)
  })

  it('should return a ref with subscribe capability', () => {
    const { matchMediaFn } = createMatchMediaMock(false)
    setupWindowMock({ matchMedia: matchMediaFn })
    const matches = usePreferredDark()
    expect(typeof matches.subscribe).toBe('function')
  })

  it('should notify subscribers when value changes via matchMedia', () => {
    const { matchMediaFn, mql } = createMatchMediaMock(false)
    setupWindowMock({ matchMedia: matchMediaFn })
    const matches = usePreferredDark()
    const cb = mock(() => {})
    matches.subscribe(cb)
    mql._trigger(true)
    expect(cb).toHaveBeenCalledTimes(1)
    expect(cb).toHaveBeenCalledWith(true, false)
  })
})

// ==========================================================================
//  useDark
// ==========================================================================
describe('useDark', () => {
  beforeEach(() => saveGlobals())
  afterEach(() => restoreGlobals())

  it('should default to false (light) when OS prefers light', () => {
    const { matchMediaFn } = createMatchMediaMock(false)
    setupWindowMock({ matchMedia: matchMediaFn })
    setupDocumentMock()
    setupLocalStorageMock()
    const isDark = useDark()
    expect(isDark.value).toBe(false)
  })

  it('should default to true (dark) when OS prefers dark', () => {
    const { matchMediaFn } = createMatchMediaMock(true)
    setupWindowMock({ matchMedia: matchMediaFn })
    setupDocumentMock()
    setupLocalStorageMock()
    const isDark = useDark()
    expect(isDark.value).toBe(true)
  })

  it('should override OS preference when localStorage has "dark"', () => {
    const { matchMediaFn } = createMatchMediaMock(false)
    setupWindowMock({ matchMedia: matchMediaFn })
    setupDocumentMock()
    const ls = setupLocalStorageMock()
    ls._store.set('color-scheme', 'dark')
    const isDark = useDark()
    expect(isDark.value).toBe(true)
  })

  it('should override OS preference when localStorage has "light"', () => {
    const { matchMediaFn } = createMatchMediaMock(true)
    setupWindowMock({ matchMedia: matchMediaFn })
    setupDocumentMock()
    const ls = setupLocalStorageMock()
    ls._store.set('color-scheme', 'light')
    const isDark = useDark()
    expect(isDark.value).toBe(false)
  })

  it('should add "dark" class to documentElement when isDark is set to true', () => {
    const { matchMediaFn } = createMatchMediaMock(false)
    setupWindowMock({ matchMedia: matchMediaFn })
    const doc = setupDocumentMock()
    setupLocalStorageMock()
    const isDark = useDark()
    expect(isDark.value).toBe(false)
    isDark.value = true
    expect(doc.documentElement.classList.contains('dark')).toBe(true)
  })

  it('should remove "dark" class from documentElement when isDark is set to false', () => {
    const { matchMediaFn } = createMatchMediaMock(true)
    setupWindowMock({ matchMedia: matchMediaFn })
    const doc = setupDocumentMock()
    setupLocalStorageMock()
    const isDark = useDark()
    expect(isDark.value).toBe(true)
    // The initial state applies dark class
    expect(doc.documentElement.classList.contains('dark')).toBe(true)
    isDark.value = false
    expect(doc.documentElement.classList.contains('dark')).toBe(false)
  })

  it('should persist to localStorage when isDark changes', () => {
    const { matchMediaFn } = createMatchMediaMock(false)
    setupWindowMock({ matchMedia: matchMediaFn })
    setupDocumentMock()
    const ls = setupLocalStorageMock()
    const isDark = useDark()
    isDark.value = true
    expect(ls.getItem('color-scheme')).toBe('dark')
    isDark.value = false
    expect(ls.getItem('color-scheme')).toBe('light')
  })

  it('should be SSR-safe without window, document, or localStorage', () => {
    delete (globalThis as any).window
    delete (globalThis as any).document
    delete (globalThis as any).localStorage
    expect(() => useDark()).not.toThrow()
    const isDark = useDark()
    expect(isDark.value).toBe(false)
  })

  it('should apply "dark" class on creation when initial state is dark', () => {
    const { matchMediaFn } = createMatchMediaMock(true)
    setupWindowMock({ matchMedia: matchMediaFn })
    const doc = setupDocumentMock()
    setupLocalStorageMock()
    useDark()
    expect(doc.documentElement.classList.contains('dark')).toBe(true)
  })

  it('should not apply "dark" class on creation when initial state is light', () => {
    const { matchMediaFn } = createMatchMediaMock(false)
    setupWindowMock({ matchMedia: matchMediaFn })
    const doc = setupDocumentMock()
    setupLocalStorageMock()
    useDark()
    expect(doc.documentElement.classList.contains('dark')).toBe(false)
  })

  it('should handle invalid localStorage value (not "dark" or "light") by following OS', () => {
    const { matchMediaFn } = createMatchMediaMock(true)
    setupWindowMock({ matchMedia: matchMediaFn })
    setupDocumentMock()
    const ls = setupLocalStorageMock()
    ls._store.set('color-scheme', 'sepia')
    // "sepia" is neither "dark" nor "light", so the OS preference (true) should be used
    const isDark = useDark()
    expect(isDark.value).toBe(true)
  })

  it('should handle invalid localStorage value when OS prefers light', () => {
    const { matchMediaFn } = createMatchMediaMock(false)
    setupWindowMock({ matchMedia: matchMediaFn })
    setupDocumentMock()
    const ls = setupLocalStorageMock()
    ls._store.set('color-scheme', 'auto')
    // "auto" is neither "dark" nor "light", so OS preference (false) should be used
    const isDark = useDark()
    expect(isDark.value).toBe(false)
  })
})

// ==========================================================================
//  useColorMode
// ==========================================================================
describe('useColorMode', () => {
  beforeEach(() => saveGlobals())
  afterEach(() => restoreGlobals())

  it('should default mode to follow system when initialValue is "auto"', () => {
    const { matchMediaFn } = createMatchMediaMock(false)
    setupWindowMock({ matchMedia: matchMediaFn })
    setupDocumentMock()
    setupLocalStorageMock()
    const { mode } = useColorMode()
    // system is light, auto follows system
    expect(mode.value).toBe('light')
  })

  it('should default store to "auto" from initialValue', () => {
    const { matchMediaFn } = createMatchMediaMock(false)
    setupWindowMock({ matchMedia: matchMediaFn })
    setupDocumentMock()
    setupLocalStorageMock()
    const { store } = useColorMode()
    expect(store.value).toBe('auto')
  })

  it('should detect dark system preference from matchMedia', () => {
    const { matchMediaFn } = createMatchMediaMock(true)
    setupWindowMock({ matchMedia: matchMediaFn })
    setupDocumentMock()
    setupLocalStorageMock()
    const { system, mode } = useColorMode()
    expect(system.value).toBe('dark')
    expect(mode.value).toBe('dark')
  })

  it('should detect light system preference from matchMedia', () => {
    const { matchMediaFn } = createMatchMediaMock(false)
    setupWindowMock({ matchMedia: matchMediaFn })
    setupDocumentMock()
    setupLocalStorageMock()
    const { system, mode } = useColorMode()
    expect(system.value).toBe('light')
    expect(mode.value).toBe('light')
  })

  it('should change mode when store is set to "dark"', () => {
    const { matchMediaFn } = createMatchMediaMock(false)
    setupWindowMock({ matchMedia: matchMediaFn })
    setupDocumentMock()
    setupLocalStorageMock()
    const { store, mode } = useColorMode()
    store.value = 'dark'
    expect(mode.value).toBe('dark')
  })

  it('should change mode when store is set to "light"', () => {
    const { matchMediaFn } = createMatchMediaMock(true)
    setupWindowMock({ matchMedia: matchMediaFn })
    setupDocumentMock()
    setupLocalStorageMock()
    const { store, mode } = useColorMode()
    expect(mode.value).toBe('dark')
    store.value = 'light'
    expect(mode.value).toBe('light')
  })

  it('should follow system when store is set to "auto"', () => {
    const { matchMediaFn } = createMatchMediaMock(true)
    setupWindowMock({ matchMedia: matchMediaFn })
    setupDocumentMock()
    setupLocalStorageMock()
    const { store, mode, system } = useColorMode()
    // Start with explicit dark
    store.value = 'light'
    expect(mode.value).toBe('light')
    // Switch back to auto
    store.value = 'auto'
    expect(mode.value).toBe(system.value)
    expect(mode.value).toBe('dark')
  })

  it('should persist to localStorage with custom key', () => {
    const { matchMediaFn } = createMatchMediaMock(false)
    setupWindowMock({ matchMedia: matchMediaFn })
    setupDocumentMock()
    const ls = setupLocalStorageMock()
    const { store } = useColorMode({ storageKey: 'my-theme' })
    store.value = 'dark'
    expect(ls.getItem('my-theme')).toBe('dark')
  })

  it('should persist to localStorage with default key', () => {
    const { matchMediaFn } = createMatchMediaMock(false)
    setupWindowMock({ matchMedia: matchMediaFn })
    setupDocumentMock()
    const ls = setupLocalStorageMock()
    const { store } = useColorMode()
    store.value = 'dark'
    expect(ls.getItem('color-mode')).toBe('dark')
  })

  it('should read from localStorage on init', () => {
    const { matchMediaFn } = createMatchMediaMock(false)
    setupWindowMock({ matchMedia: matchMediaFn })
    setupDocumentMock()
    const ls = setupLocalStorageMock()
    ls._store.set('color-mode', 'dark')
    const { store, mode } = useColorMode()
    expect(store.value).toBe('dark')
    expect(mode.value).toBe('dark')
  })

  it('should apply class to documentElement by default', () => {
    const { matchMediaFn } = createMatchMediaMock(true)
    setupWindowMock({ matchMedia: matchMediaFn })
    const doc = setupDocumentMock()
    setupLocalStorageMock()
    useColorMode()
    // system is dark, auto follows system, so mode is "dark"
    expect(doc.documentElement.classList.contains('dark')).toBe(true)
  })

  it('should apply attribute when attribute is not "class"', () => {
    const { matchMediaFn } = createMatchMediaMock(true)
    setupWindowMock({ matchMedia: matchMediaFn })
    const doc = setupDocumentMock()
    setupLocalStorageMock()
    useColorMode({ attribute: 'data-theme' })
    expect(doc.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('should support custom modes mapping', () => {
    const { matchMediaFn } = createMatchMediaMock(false)
    setupWindowMock({ matchMedia: matchMediaFn })
    const doc = setupDocumentMock()
    setupLocalStorageMock()
    const { store } = useColorMode({
      modes: { coffee: 'theme-coffee', dim: 'theme-dim' },
    })
    store.value = 'coffee'
    expect(doc.documentElement.classList.contains('theme-coffee')).toBe(true)
  })

  it('should be SSR-safe without window or document', () => {
    delete (globalThis as any).window
    delete (globalThis as any).document
    delete (globalThis as any).localStorage
    expect(() => useColorMode()).not.toThrow()
    const { mode, system, store } = useColorMode()
    expect(system.value).toBe('light')
    expect(store.value).toBe('auto')
    expect(mode.value).toBe('light')
  })

  it('should handle selector that does not match any element', () => {
    const { matchMediaFn } = createMatchMediaMock(true)
    setupWindowMock({ matchMedia: matchMediaFn })
    setupDocumentMock()
    setupLocalStorageMock()
    // The mock document.querySelector returns null for non-'html' selectors
    expect(() => useColorMode({ selector: '#nonexistent' })).not.toThrow()
    const { mode, store } = useColorMode({ selector: '#nonexistent' })
    // mode should still track correctly even if the element is not found
    store.value = 'dark'
    expect(mode.value).toBe('dark')
  })

  it('should update mode when system preference changes and store is "auto"', () => {
    const { matchMediaFn, mql } = createMatchMediaMock(false)
    setupWindowMock({ matchMedia: matchMediaFn })
    setupDocumentMock()
    setupLocalStorageMock()
    const { mode, system, store } = useColorMode()
    expect(store.value).toBe('auto')
    expect(system.value).toBe('light')
    expect(mode.value).toBe('light')
    // Simulate OS switching to dark
    mql._trigger(true)
    expect(system.value).toBe('dark')
    // Since the preload watch fires synchronously on subscribe,
    // the watch(system, ...) should have updated mode
    expect(mode.value).toBe('dark')
  })

  it('should remove previous mode class when changing modes', () => {
    const { matchMediaFn } = createMatchMediaMock(false)
    setupWindowMock({ matchMedia: matchMediaFn })
    const doc = setupDocumentMock()
    setupLocalStorageMock()
    const { store } = useColorMode()
    // Initial is light (auto follows system=light)
    expect(doc.documentElement.classList.contains('light')).toBe(true)
    store.value = 'dark'
    // After switching to dark, "light" should be removed
    expect(doc.documentElement.classList.contains('dark')).toBe(true)
    expect(doc.documentElement.classList.contains('light')).toBe(false)
  })
})

// ==========================================================================
//  useNetwork
// ==========================================================================
describe('useNetwork', () => {
  beforeEach(() => saveGlobals())
  afterEach(() => restoreGlobals())

  it('should default isOnline to navigator.onLine', () => {
    setupWindowMock()
    setupNavigatorMock({ onLine: true })
    const { isOnline } = useNetwork()
    expect(isOnline.value).toBe(true)
  })

  it('should default isOnline to false when navigator.onLine is false', () => {
    setupWindowMock()
    setupNavigatorMock({ onLine: false })
    const { isOnline } = useNetwork()
    expect(isOnline.value).toBe(false)
  })

  it('should become true on online event', () => {
    const win = setupWindowMock()
    setupNavigatorMock({ onLine: false })
    const { isOnline } = useNetwork()
    expect(isOnline.value).toBe(false)
    // Fire the online event
    for (const h of (win.__listeners['online'] ?? [])) h({ type: 'online' })
    expect(isOnline.value).toBe(true)
  })

  it('should become false on offline event', () => {
    const win = setupWindowMock()
    setupNavigatorMock({ onLine: true })
    const { isOnline } = useNetwork()
    expect(isOnline.value).toBe(true)
    for (const h of (win.__listeners['offline'] ?? [])) h({ type: 'offline' })
    expect(isOnline.value).toBe(false)
  })

  it('should set onlineAt timestamp on online event', () => {
    const win = setupWindowMock()
    setupNavigatorMock({ onLine: false })
    const before = Date.now()
    const { onlineAt } = useNetwork()
    expect(onlineAt.value).toBeUndefined()
    for (const h of (win.__listeners['online'] ?? [])) h({ type: 'online' })
    const after = Date.now()
    expect(onlineAt.value).toBeDefined()
    expect(onlineAt.value).toBeGreaterThanOrEqual(before)
    expect(onlineAt.value).toBeLessThanOrEqual(after)
  })

  it('should set offlineAt timestamp on offline event', () => {
    const win = setupWindowMock()
    setupNavigatorMock({ onLine: true })
    const before = Date.now()
    const { offlineAt } = useNetwork()
    expect(offlineAt.value).toBeUndefined()
    for (const h of (win.__listeners['offline'] ?? [])) h({ type: 'offline' })
    const after = Date.now()
    expect(offlineAt.value).toBeDefined()
    expect(offlineAt.value).toBeGreaterThanOrEqual(before)
    expect(offlineAt.value).toBeLessThanOrEqual(after)
  })

  it('should read connection info when navigator.connection exists', () => {
    const connListeners: Record<string, Set<Function>> = {}
    const connection = {
      downlink: 10,
      downlinkMax: 100,
      effectiveType: '4g',
      rtt: 50,
      saveData: false,
      type: 'wifi',
      addEventListener: (t: string, fn: Function) => {
        if (!connListeners[t]) connListeners[t] = new Set()
        connListeners[t].add(fn)
      },
      removeEventListener: (t: string, fn: Function) => {
        connListeners[t]?.delete(fn)
      },
    }
    setupWindowMock()
    setupNavigatorMock({ onLine: true, connection })
    const { downlink, downlinkMax, effectiveType, rtt, saveData, type } = useNetwork()
    expect(downlink.value).toBe(10)
    expect(downlinkMax.value).toBe(100)
    expect(effectiveType.value).toBe('4g')
    expect(rtt.value).toBe(50)
    expect(saveData.value).toBe(false)
    expect(type.value).toBe('wifi')
  })

  it('should update connection info on change event', () => {
    const connListeners: Record<string, Set<Function>> = {}
    const connection: any = {
      downlink: 10,
      effectiveType: '4g',
      rtt: 50,
      saveData: false,
      type: 'wifi',
      addEventListener: (t: string, fn: Function) => {
        if (!connListeners[t]) connListeners[t] = new Set()
        connListeners[t].add(fn)
      },
      removeEventListener: (t: string, fn: Function) => {
        connListeners[t]?.delete(fn)
      },
    }
    setupWindowMock()
    setupNavigatorMock({ onLine: true, connection })
    const { downlink, effectiveType, rtt } = useNetwork()
    expect(downlink.value).toBe(10)
    // Update connection values and fire change
    connection.downlink = 2
    connection.effectiveType = '3g'
    connection.rtt = 200
    for (const fn of (connListeners['change'] ?? [])) fn()
    expect(downlink.value).toBe(2)
    expect(effectiveType.value).toBe('3g')
    expect(rtt.value).toBe(200)
  })

  it('should set isSupported to true when navigator.connection exists', () => {
    const connection = {
      downlink: 10,
      effectiveType: '4g',
      rtt: 50,
      addEventListener: () => {},
      removeEventListener: () => {},
    }
    setupWindowMock()
    setupNavigatorMock({ onLine: true, connection })
    const { isSupported } = useNetwork()
    expect(isSupported.value).toBe(true)
  })

  it('should set isSupported to false without navigator.connection', () => {
    setupWindowMock()
    setupNavigatorMock({ onLine: true })
    const { isSupported } = useNetwork()
    expect(isSupported.value).toBe(false)
  })

  it('should be SSR-safe without window or navigator', () => {
    delete (globalThis as any).window
    delete (globalThis as any).navigator
    expect(() => useNetwork()).not.toThrow()
    const { isOnline, isSupported } = useNetwork()
    expect(isOnline.value).toBe(true) // defaults to true when no navigator
    expect(isSupported.value).toBe(false)
  })

  it('should handle navigator.connection with null properties', () => {
    const connection = {
      downlink: null,
      downlinkMax: null,
      effectiveType: null,
      rtt: null,
      saveData: null,
      type: null,
      addEventListener: () => {},
      removeEventListener: () => {},
    }
    setupWindowMock()
    setupNavigatorMock({ onLine: true, connection })
    const { downlink, downlinkMax, effectiveType, rtt, saveData, type, isSupported } = useNetwork()
    expect(isSupported.value).toBe(true)
    expect(downlink.value).toBeNull()
    expect(downlinkMax.value).toBeNull()
    expect(effectiveType.value).toBeNull()
    expect(rtt.value).toBeNull()
    expect(saveData.value).toBeNull()
    expect(type.value).toBeNull()
  })

  it('should handle connection without addEventListener', () => {
    // Some browsers may expose connection but without addEventListener
    const connection = {
      downlink: 5,
      effectiveType: '3g',
      rtt: 100,
    }
    setupWindowMock()
    setupNavigatorMock({ onLine: true, connection })
    expect(() => useNetwork()).not.toThrow()
    const { downlink, isSupported } = useNetwork()
    expect(isSupported.value).toBe(true)
    expect(downlink.value).toBe(5)
  })
})

// ==========================================================================
//  useOnline
// ==========================================================================
describe('useOnline', () => {
  beforeEach(() => saveGlobals())
  afterEach(() => restoreGlobals())

  it('should default to navigator.onLine value (true)', () => {
    setupWindowMock()
    setupNavigatorMock({ onLine: true })
    const isOnline = useOnline()
    expect(isOnline.value).toBe(true)
  })

  it('should default to navigator.onLine value (false)', () => {
    setupWindowMock()
    setupNavigatorMock({ onLine: false })
    const isOnline = useOnline()
    expect(isOnline.value).toBe(false)
  })

  it('should update to true on online event', () => {
    const win = setupWindowMock()
    setupNavigatorMock({ onLine: false })
    const isOnline = useOnline()
    expect(isOnline.value).toBe(false)
    for (const h of (win.__listeners['online'] ?? [])) h({ type: 'online' })
    expect(isOnline.value).toBe(true)
  })

  it('should update to false on offline event', () => {
    const win = setupWindowMock()
    setupNavigatorMock({ onLine: true })
    const isOnline = useOnline()
    expect(isOnline.value).toBe(true)
    for (const h of (win.__listeners['offline'] ?? [])) h({ type: 'offline' })
    expect(isOnline.value).toBe(false)
  })

  it('should default to true without navigator (SSR)', () => {
    delete (globalThis as any).navigator
    delete (globalThis as any).window
    const isOnline = useOnline()
    expect(isOnline.value).toBe(true)
  })

  it('should be SSR-safe without window', () => {
    setupNavigatorMock({ onLine: false })
    delete (globalThis as any).window
    const isOnline = useOnline()
    // navigator.onLine is false, but no event listeners are attached
    expect(isOnline.value).toBe(false)
  })

  it('should track multiple events correctly', () => {
    const win = setupWindowMock()
    setupNavigatorMock({ onLine: true })
    const isOnline = useOnline()
    expect(isOnline.value).toBe(true)
    for (const h of (win.__listeners['offline'] ?? [])) h({ type: 'offline' })
    expect(isOnline.value).toBe(false)
    for (const h of (win.__listeners['online'] ?? [])) h({ type: 'online' })
    expect(isOnline.value).toBe(true)
    for (const h of (win.__listeners['offline'] ?? [])) h({ type: 'offline' })
    expect(isOnline.value).toBe(false)
    for (const h of (win.__listeners['online'] ?? [])) h({ type: 'online' })
    expect(isOnline.value).toBe(true)
  })

  it('should return a ref with subscribe capability', () => {
    setupWindowMock()
    setupNavigatorMock({ onLine: true })
    const isOnline = useOnline()
    expect(typeof isOnline.subscribe).toBe('function')
  })
})

// ==========================================================================
//  useToggle
// ==========================================================================
describe('useToggle', () => {
  it('should default to false', () => {
    const [state] = useToggle()
    expect(state.value).toBe(false)
  })

  it('should accept an initial boolean value', () => {
    const [state] = useToggle(true)
    expect(state.value).toBe(true)
  })

  it('should toggle from false to true', () => {
    const [state, toggle] = useToggle(false)
    toggle()
    expect(state.value).toBe(true)
  })

  it('should toggle from true to false', () => {
    const [state, toggle] = useToggle(true)
    toggle()
    expect(state.value).toBe(false)
  })

  it('should set a specific value via toggle(true)', () => {
    const [state, toggle] = useToggle(false)
    toggle(true)
    expect(state.value).toBe(true)
  })

  it('should set a specific value via toggle(false)', () => {
    const [state, toggle] = useToggle(true)
    toggle(false)
    expect(state.value).toBe(false)
  })

  it('should return the new state from toggle()', () => {
    const [, toggle] = useToggle(false)
    const result = toggle()
    expect(result).toBe(true)
  })

  it('should return the new state from toggle(value)', () => {
    const [, toggle] = useToggle(false)
    const result = toggle(true)
    expect(result).toBe(true)
    const result2 = toggle(false)
    expect(result2).toBe(false)
  })

  it('should toggle multiple times correctly', () => {
    const [state, toggle] = useToggle(false)
    toggle()
    expect(state.value).toBe(true)
    toggle()
    expect(state.value).toBe(false)
    toggle()
    expect(state.value).toBe(true)
    toggle()
    expect(state.value).toBe(false)
  })

  it('should accept a ref as initialValue and use it as state', async () => {
    // The preload provides ref, but useToggle imports from @stacksjs/stx
    // which is mocked. We need to create a ref-like object.
    const { ref } = await import('@stacksjs/stx')
    const externalRef = ref(true)
    const [state, toggle] = useToggle(externalRef as any)
    expect(state.value).toBe(true)
    toggle()
    expect(state.value).toBe(false)
    // The external ref should be the same object
    expect(externalRef.value).toBe(false)
  })

  it('should handle toggle(false) when already false (idempotent)', () => {
    const [state, toggle] = useToggle(false)
    toggle(false)
    expect(state.value).toBe(false)
  })

  it('should handle toggle(true) when already true (idempotent)', () => {
    const [state, toggle] = useToggle(true)
    toggle(true)
    expect(state.value).toBe(true)
  })
})
