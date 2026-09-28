import { describe, expect, it } from 'bun:test'

const { deepLinks, hasNativeMobileHost, health, isNativeMobile, liveActivities, normalizeDeepLinkURL, onMobileReady, watchConnectivity, whenNativeMobile, withNativeFeedback } = await import('../src')

describe('@stacksjs/mobile', () => {
  it('stays browser-safe when the Craft host is absent', () => {
    expect(isNativeMobile()).toBe(false)
    expect(typeof onMobileReady(() => {})).toBe('function')
  })

  it('returns the native action result through feedback', async () => {
    await expect(withNativeFeedback(async () => 'recorded')).resolves.toBe('recorded')
  })

  it('exposes typed native activity services', () => {
    expect(typeof health.getData).toBe('function')
    expect(typeof health.saveWorkout).toBe('function')
    expect(typeof health.getWorkouts).toBe('function')
    expect(typeof health.getDailyStatistics).toBe('function')
    expect(typeof liveActivities.start).toBe('function')
    expect(typeof watchConnectivity.isReachable).toBe('function')
  })

  it('normalizes structured native deep-link payloads', () => {
    expect(normalizeDeepLinkURL('wildloop://record')).toBe('wildloop://record')
    expect(normalizeDeepLinkURL({ url: 'wildloop://trail/42' })).toBe('wildloop://trail/42')
    expect(normalizeDeepLinkURL({ path: '/record' })).toBeNull()
  })

  it('delegates normalized deep links through the real Craft browser entrypoint', async () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'window')
    Object.defineProperty(globalThis, 'window', { configurable: true, value: {
      craft: {
        deepLinks: {
          getInitialURL: async () => ({ url: 'wildloop://record' }),
          onLink: (callback: (value: unknown) => void) => {
            callback({ url: 'wildloop://trail/42' })
            return () => {}
          },
        },
      },
    } })
    try {
      await expect(deepLinks.getInitialURL()).resolves.toBe('wildloop://record')
      let received: string | undefined
      const unsubscribe = deepLinks.onLink(value => received = value)
      expect(received).toBe('wildloop://trail/42')
      expect(typeof unsubscribe).toBe('function')
    }
    finally {
      if (original) Object.defineProperty(globalThis, 'window', original)
      else Reflect.deleteProperty(globalThis, 'window')
    }
  })

  it('knows a phone shell before its bridge is installed, and answers a browser at once', async () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'window')
    const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
    const setWindow = (value: unknown) => Object.defineProperty(globalThis, 'window', { configurable: true, value })
    const setAgent = (userAgent: string) => Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { userAgent } })
    try {
      await expect(whenNativeMobile(10)).resolves.toBe(false)

      // Android's interface exists before the page starts; the bridge does not.
      setWindow(Object.assign(new EventTarget(), { CraftAndroid: {} }))
      expect(hasNativeMobileHost()).toBe(true)
      await expect(whenNativeMobile(10)).resolves.toBe(true)

      // iOS: the message handler plus an iPhone user agent.
      setAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')
      setWindow(Object.assign(new EventTarget(), { webkit: { messageHandlers: { craft: {} } } }))
      expect(hasNativeMobileHost()).toBe(true)

      // The same handler in a macOS Craft window is not the phone app, and
      // with no bridge by the deadline the answer is false.
      setAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0)')
      expect(hasNativeMobileHost()).toBe(false)
      await expect(whenNativeMobile(10)).resolves.toBe(false)

      // Answered by craftReady once the bridge arrives.
      const target = Object.assign(new EventTarget(), { webkit: { messageHandlers: { craft: {} } } }) as EventTarget & { craft?: unknown }
      setWindow(target)
      const pending = whenNativeMobile(1000)
      target.craft = { platform: 'ios', capabilities: {} }
      target.dispatchEvent(new Event('craftReady'))
      await expect(pending).resolves.toBe(true)
    }
    finally {
      if (original) Object.defineProperty(globalThis, 'window', original)
      else Reflect.deleteProperty(globalThis, 'window')
      if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator)
    }
  })
})
