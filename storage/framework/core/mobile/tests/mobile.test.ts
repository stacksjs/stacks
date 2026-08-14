import { describe, expect, it } from 'bun:test'
import { health, isNativeMobile, liveActivities, onMobileReady, watchConnectivity, withNativeFeedback } from '../src'

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
    expect(typeof liveActivities.start).toBe('function')
    expect(typeof watchConnectivity.isReachable).toBe('function')
  })
})
