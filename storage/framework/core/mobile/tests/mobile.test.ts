import { describe, expect, it } from 'bun:test'
import { isNativeMobile, onMobileReady, withNativeFeedback } from '../src'

describe('@stacksjs/mobile', () => {
  it('stays browser-safe when the Craft host is absent', () => {
    expect(isNativeMobile()).toBe(false)
    expect(typeof onMobileReady(() => {})).toBe('function')
  })

  it('returns the native action result through feedback', async () => {
    await expect(withNativeFeedback(async () => 'recorded')).resolves.toBe('recorded')
  })
})
