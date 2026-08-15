import { describe, expect, it } from 'bun:test'
import { normalizeMobileUrl, resolveMobilePath, toCraftIosConfig, validateIosMobileConfig } from './ios-config'

describe('iOS mobile build configuration', () => {
  it('maps Stacks capabilities onto Craft feature flags', () => {
    const config = toCraftIosConfig({
      appName: 'WildLoop',
      bundleId: 'org.wildloop.app',
      url: 'wildloop.org',
      associatedDomains: ['applinks:wildloop.org'],
      deviceFamilies: ['iphone'],
      watchDeploymentTarget: '9.0',
      capabilities: { backgroundLocation: true, geolocation: true, haptics: true, camera: false, liveActivities: true, watchApp: true },
    })

    expect(config.devServerURL).toBe('https://wildloop.org')
    expect(config.enableGeolocation).toBe(true)
    expect(config.enableHaptics).toBe(true)
    expect(config.enableCamera).toBe(false)
    expect(config.enableBackgroundLocation).toBe(true)
    expect(config.enableLiveActivities).toBe(true)
    expect(config.enableWatchApp).toBe(true)
    expect(config.watchosVersion).toBe('9.0')
    expect(config.trustedOrigins).toEqual(['https://wildloop.org'])
    expect(config.associatedDomains).toEqual(['applinks:wildloop.org'])
    expect(config.deviceFamilies).toEqual(['iphone'])
  })

  it('rejects insecure production URLs and malformed associated domains', () => {
    expect(() => validateIosMobileConfig({
      appName: 'WildLoop',
      bundleId: 'org.wildloop.app',
      url: 'http://wildloop.org',
    })).toThrow('must use HTTPS')
    expect(() => validateIosMobileConfig({
      appName: 'WildLoop',
      bundleId: 'org.wildloop.app',
      url: 'https://wildloop.org',
      associatedDomains: ['https://wildloop.org'],
    })).toThrow('Invalid iOS associated domain')
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

  it('allows a bundled offline fallback only for remote applications', () => {
    expect(() => validateIosMobileConfig({
      appName: 'WildLoop',
      bundleId: 'org.wildloop.app',
      url: 'wildloop.org',
      fallbackWebAssets: 'dist',
    })).not.toThrow()
    expect(() => validateIosMobileConfig({
      appName: 'WildLoop',
      bundleId: 'org.wildloop.app',
      webAssets: 'dist',
      fallbackWebAssets: 'fallback',
    })).toThrow('fallbackWebAssets requires ios.url')
  })

  it('requires a supported watchOS target for companion apps', () => {
    expect(() => validateIosMobileConfig({
      appName: 'WildLoop',
      bundleId: 'org.wildloop.app',
      url: 'wildloop.org',
      watchDeploymentTarget: '8.0',
      capabilities: { watchApp: true },
    })).toThrow('watchOS 9.0 or newer')
  })

  it('requires at least one supported Apple device family', () => {
    expect(() => validateIosMobileConfig({
      appName: 'WildLoop',
      bundleId: 'org.wildloop.app',
      url: 'wildloop.org',
      deviceFamilies: [],
    })).toThrow('iphone and/or ipad')
  })
})
