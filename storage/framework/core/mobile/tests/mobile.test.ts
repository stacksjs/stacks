import { describe, expect, it } from 'bun:test'

const { deepLinks, health, isNativeMobile, liveActivities, normalizeDeepLinkURL, onMobileReady, watchConnectivity, withNativeFeedback } = await import('../src')

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
})
