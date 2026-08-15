import { describe, expect, it, mock } from 'bun:test'

mock.module('craft-native/mobile', () => ({
  appReview: {},
  biometrics: {},
  camera: {},
  deepLinks: {
    getInitialURL: async () => ({ url: 'wildloop://record' }),
    onLink: (callback: (value: unknown) => void) => {
      callback({ url: 'wildloop://trail/42' })
      return () => {}
    },
  },
  device: { isMobile: () => false },
  haptics: { impact: async () => {}, notification: async () => {} },
  health: { getData: async () => ({ unit: 'count', value: 0 }), saveWorkout: async () => ({ id: 'workout' }) },
  keepAwake: {},
  lifecycle: {},
  liveActivities: { start: async () => ({ id: 'test' }) },
  location: {},
  network: {},
  notifications: {},
  permissions: {},
  pushNotifications: {},
  secureStorage: {},
  share: {},
  watchConnectivity: { isReachable: async () => false },
}))

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

  it('delegates normalized deep links through the lazy Craft surface', async () => {
    await expect(deepLinks.getInitialURL()).resolves.toBe('wildloop://record')

    let received: string | undefined
    const unsubscribe = deepLinks.onLink(value => received = value)
    expect(received).toBe('wildloop://trail/42')
    expect(typeof unsubscribe).toBe('function')
  })
})
