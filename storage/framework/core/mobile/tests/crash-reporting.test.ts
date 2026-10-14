import { afterEach, describe, expect, it } from 'bun:test'

const { crashReporting, keepBreadcrumb } = await import('../src')

/**
 * A phone app's web view: Craft's iOS message handler, an iPhone user agent,
 * and the `craft.crashReporter` bridge recording what it is handed.
 */
function inApp(reporter: Record<string, (...args: any[]) => any> | null) {
  const handed: Array<[string, unknown]> = []
  const bridge = reporter ?? {
    capture: async (event: unknown) => { handed.push(['capture', event]); return true },
    setUser: async (id: unknown) => { handed.push(['setUser', id]); return true },
    addBreadcrumb: async (crumb: unknown) => { handed.push(['addBreadcrumb', crumb]); return true },
    flush: async () => true,
    context: async () => ({ enabled: true }),
  }
  const listeners: Record<string, Array<(event: any) => void>> = {}
  const win: any = {
    craft: { crashReporter: bridge, capabilities: { crashReporter: true } },
    webkit: { messageHandlers: { craft: { postMessage() {} } } },
    addEventListener: (type: string, fn: (event: any) => void) => { (listeners[type] ||= []).push(fn) },
    removeEventListener: () => {},
    location: { href: 'https://hq.training/m', origin: 'https://hq.training', pathname: '/m' },
  }
  Object.defineProperty(globalThis, 'window', { configurable: true, value: win })
  Object.defineProperty(globalThis, 'craft', { configurable: true, value: win.craft })
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X)', onLine: true } })
  return { handed, fire: (type: string, event: any) => (listeners[type] || []).forEach(fn => fn(event)) }
}

const saved = {
  window: Object.getOwnPropertyDescriptor(globalThis, 'window'),
  craft: Object.getOwnPropertyDescriptor(globalThis, 'craft'),
  navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator'),
  fetch: globalThis.fetch,
}

afterEach(() => {
  crashReporting.stop()
  for (const [name, descriptor] of Object.entries(saved)) {
    if (name === 'fetch') continue
    if (descriptor) Object.defineProperty(globalThis, name, descriptor as PropertyDescriptor)
    else delete (globalThis as any)[name]
  }
  globalThis.fetch = saved.fetch
})

describe('crash reporting', () => {
  it('does nothing in a browser without a key, so the website reports nothing by accident', () => {
    expect(crashReporting.start()).toBeNull()
  })

  it('hands a web view\'s errors to the app\'s native reporter, with no key and no HTTP', async () => {
    const posted: string[] = []
    globalThis.fetch = (async (url: string) => { posted.push(String(url)); return new Response(null, { status: 201 }) }) as any
    const { handed, fire } = inApp(null)
    const client = crashReporting.start()
    expect(client).not.toBeNull()
    fire('error', { error: new TypeError('cannot read workout') })
    await crashReporting.flush()
    const capture = handed.find(([kind]) => kind === 'capture')
    expect(capture?.[1]).toMatchObject({ type: 'TypeError', message: 'cannot read workout' })
    // No heartbeat and no ingest request: the native reporter owns delivery.
    expect(posted).toEqual([])
  })

  it('names the user by id to the page and the native reporter, and clears it', async () => {
    const { handed } = inApp(null)
    crashReporting.start()
    await crashReporting.setUser(967)
    await crashReporting.setUser(null)
    expect(handed.filter(([kind]) => kind === 'setUser').map(([, id]) => id)).toEqual(['967', null])
  })

  it('keeps failed requests and screen changes as breadcrumbs, not successful requests', () => {
    expect(keepBreadcrumb({ type: 'http', data: { status: 200 } })).toBe(false)
    expect(keepBreadcrumb({ type: 'http', data: { status: 503 } })).toBe(true)
    expect(keepBreadcrumb({ type: 'http', data: { error: true } })).toBe(true)
    expect(keepBreadcrumb({ type: 'navigation', message: '/m/calendar' })).toBe(true)
  })

  it('mirrors kept breadcrumbs to the native reporter, so a crash carries them', () => {
    const { handed } = inApp(null)
    crashReporting.start()
    crashReporting.addBreadcrumb({ type: 'navigation', category: 'navigation', message: '/m/calendar' })
    crashReporting.client()?.addBreadcrumb({ type: 'http', category: 'fetch', data: { status: 200 } })
    const crumbs = handed.filter(([kind]) => kind === 'addBreadcrumb').map(([, crumb]) => crumb)
    expect(crumbs).toHaveLength(1)
    expect(crumbs[0]).toMatchObject({ message: '/m/calendar' })
  })

  it('drops an event when the app has no native reporter and the page has no key', async () => {
    const posted: string[] = []
    globalThis.fetch = (async (url: string) => { posted.push(String(url)); return new Response(null, { status: 201 }) }) as any
    const { fire } = inApp({ capture: async () => true, setUser: async () => true, addBreadcrumb: async () => true, flush: async () => true, context: async () => ({}) })
    ;(globalThis as any).craft.capabilities = { crashReporter: false }
    crashReporting.start()
    fire('error', { error: new Error('nowhere to go') })
    await crashReporting.flush()
    expect(posted).toEqual([])
  })
})
