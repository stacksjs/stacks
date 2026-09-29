import { afterEach, describe, expect, it } from 'bun:test'
import { deepLinks, getNativeMobileBridge, isNativeMobile, mobile, onMobileReady, whenBridgeReady } from '../src'

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')

function setHost(craft?: unknown): EventTarget & { craft?: unknown } {
  const window = Object.assign(new EventTarget(), { craft })
  Object.defineProperty(globalThis, 'window', { configurable: true, value: window })
  return window
}

afterEach(() => {
  if (originalWindow)
    Object.defineProperty(globalThis, 'window', originalWindow)
  else
    Reflect.deleteProperty(globalThis, 'window')
})

describe('native mobile bridge availability', () => {
  it('returns null in a browser without Craft', () => {
    setHost()
    expect(getNativeMobileBridge()).toBeNull()
    expect(mobile.nativeBridge).toBeNull()
    expect(isNativeMobile()).toBe(false)
    expect(typeof mobile.location.getCurrentPosition).toBe('function')
  })

  it('is safe during server rendering without a window', () => {
    Reflect.deleteProperty(globalThis, 'window')
    expect(getNativeMobileBridge()).toBeNull()
    expect(mobile.nativeBridge).toBeNull()
    expect(isNativeMobile()).toBe(false)
    expect(typeof onMobileReady(() => {})).toBe('function')
  })

  it.each(['ios', 'android'] as const)('uses the %s native platform instead of the user agent', (platform) => {
    setHost({ platform, capabilities: { geolocation: true, backgroundLocation: false } })
    expect(getNativeMobileBridge()).toEqual({
      platform,
      capabilities: { geolocation: true, backgroundLocation: false },
    })
    expect(mobile.nativeBridge?.platform).toBe(platform)
    expect(isNativeMobile()).toBe(true)
  })

  it.each([null, true, 'craft', {}, { platform: 'macos' }])('does not treat an unrelated or desktop host as mobile: %j', (craft) => {
    setHost(craft)
    expect(getNativeMobileBridge()).toBeNull()
    expect(isNativeMobile()).toBe(false)
  })

  it('keeps disabled, missing, and platform-specific flags distinct', () => {
    setHost({ platform: 'ios', capabilities: { healthKit: true, camera: false, secureStorage: 'yes' } })
    expect(mobile.nativeBridge?.capabilities.healthKit).toBe(true)
    expect(mobile.nativeBridge?.capabilities.camera).toBe(false)
    expect(mobile.nativeBridge?.capabilities.secureStorage).toBeUndefined()
    expect(mobile.nativeBridge?.capabilities.health).toBeUndefined()
    setHost({ platform: 'android', capabilities: { health: true } })
    expect(mobile.nativeBridge?.capabilities.health).toBe(true)
    expect(mobile.nativeBridge?.capabilities.healthKit).toBeUndefined()
  })

  it('does not invent enabled capabilities for older hosts', () => {
    setHost({ platform: 'ios' })
    expect(getNativeMobileBridge()).toEqual({ platform: 'ios', capabilities: {} })
  })

  it('observes late injection and removal without reimporting the package', () => {
    const current = setHost()
    let platform: string | undefined
    const dispose = mobile.onReady(() => { platform = mobile.nativeBridge?.platform })
    expect(mobile.nativeBridge).toBeNull()
    current.craft = { platform: 'android', capabilities: { deepLinks: true } }
    current.dispatchEvent(new Event('craftReady'))
    expect(platform).toBe('android')
    expect(getNativeMobileBridge()?.capabilities.deepLinks).toBe(true)
    current.craft = undefined
    expect(mobile.nativeBridge).toBeNull()
    dispose()
  })

  it('notifies an already-ready native host and supports cancellation', async () => {
    setHost({ platform: 'ios', capabilities: {} })
    let calls = 0
    mobile.onReady(() => { calls++ })
    mobile.onReady(() => { calls++ })()
    await Promise.resolve()
    expect(calls).toBe(1)
  })

  it('ignores non-mobile readiness and unsubscribes from a pending event', async () => {
    const current = setHost({ platform: 'macos' })
    let calls = 0
    const dispose = onMobileReady(() => { calls++ })
    await Promise.resolve()
    current.dispatchEvent(new Event('craftReady'))
    expect(calls).toBe(0)
    dispose()
    current.craft = { platform: 'ios' }
    current.dispatchEvent(new Event('craftReady'))
    expect(calls).toBe(0)
  })
})

describe('deep links before the bridge', () => {
  /** The phone shell as a page first sees it: Craft's transport, no bridge yet. */
  function appHostWithoutBridge(): EventTarget & { craft?: unknown } {
    const current = setHost()
    Object.assign(current, { webkit: { messageHandlers: { craft: { postMessage() {} } } } })
    return current
  }

  function installBridge(current: EventTarget & { craft?: unknown }, links: { initial: string | null, subscribers: Array<(detail: unknown) => void> }): void {
    current.craft = {
      platform: 'ios',
      capabilities: { deepLinks: true },
      deepLinks: {
        getInitialURL: async () => (links.initial ? { url: links.initial } : null),
        onLink: (callback: (detail: unknown) => void) => {
          links.subscribers.push(callback)
          return () => {}
        },
      },
    }
    current.dispatchEvent(new Event('craftReady'))
  }

  it('reads the launch link once the bridge is installed, not null before it', async () => {
    const current = appHostWithoutBridge()
    const links = { initial: 'hqtraining://m/go/9739', subscribers: [] as Array<(detail: unknown) => void> }
    const initial = deepLinks.getInitialURL()
    await Promise.resolve()
    installBridge(current, links)
    expect(await initial).toBe('hqtraining://m/go/9739')
  })

  it('subscribes to links once the bridge is installed', async () => {
    const current = appHostWithoutBridge()
    const links = { initial: null, subscribers: [] as Array<(detail: unknown) => void> }
    const received: string[] = []
    const stop = deepLinks.onLink(url => received.push(url))
    installBridge(current, links)
    await Promise.resolve()
    await Promise.resolve()
    expect(links.subscribers.length).toBe(1)
    links.subscribers[0]!({ url: 'hqtraining://m/calendar', initial: false })
    expect(received).toEqual(['hqtraining://m/calendar'])
    stop()
  })

  it('does not subscribe after an unsubscribe that came first', async () => {
    const current = appHostWithoutBridge()
    const links = { initial: null, subscribers: [] as Array<(detail: unknown) => void> }
    deepLinks.onLink(() => {})()
    installBridge(current, links)
    await Promise.resolve()
    await Promise.resolve()
    expect(links.subscribers.length).toBe(0)
  })

  it('answers at once in a browser, which has no deep links', async () => {
    setHost()
    expect(await whenBridgeReady()).toBe(false)
    expect(await deepLinks.getInitialURL()).toBeNull()
  })
})
