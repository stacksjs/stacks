import { describe, expect, it } from 'bun:test'
import { normalizeMobileUrl, resolveMobilePath, toCraftIosConfig, validateIosMobileConfig } from './ios-config'

describe('iOS mobile build configuration', () => {
  it('maps Stacks capabilities onto Craft feature flags', () => {
    const config = toCraftIosConfig({
      appName: 'WildLoop',
      bundleId: 'org.wildloop.app',
      url: 'wildloop.org',
      capabilities: { geolocation: true, haptics: true, camera: false },
    })

    expect(config.devServerURL).toBe('https://wildloop.org')
    expect(config.enableGeolocation).toBe(true)
    expect(config.enableHaptics).toBe(true)
    expect(config.enableCamera).toBe(false)
  })

  it('normalizes URLs and project-relative asset paths', () => {
    expect(normalizeMobileUrl('https://wildloop.org/')).toBe('https://wildloop.org')
    expect(resolveMobilePath('/project', 'dist/mobile')).toBe('/project/dist/mobile')
  })

  it('requires exactly one web source', () => {
    expect(() => validateIosMobileConfig({
      appName: 'WildLoop',
      bundleId: 'org.wildloop.app',
      url: 'wildloop.org',
      webAssets: 'dist',
    })).toThrow('either ios.url or ios.webAssets')
  })
})
