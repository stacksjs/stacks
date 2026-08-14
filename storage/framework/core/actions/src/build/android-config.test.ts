import { describe, expect, it } from 'bun:test'
import { toCraftAndroidConfig, validateAndroidMobileConfig } from './android-config'

describe('Android mobile build configuration', () => {
  it('maps Stacks capabilities onto the Craft Android builder', () => {
    const config = toCraftAndroidConfig({
      appName: 'WildLoop',
      packageName: 'org.wildloop.app',
      url: 'wildloop.org',
      urlSchemes: ['wildloop'],
      googleServicesFile: 'secrets/google-services.json',
      capabilities: { backgroundLocation: true, haptics: true, camera: false, healthConnect: true },
    })
    expect(config.devServerURL).toBe('https://wildloop.org')
    expect(config.trustedOrigins).toEqual(['https://wildloop.org'])
    expect(config.urlSchemes).toEqual(['wildloop'])
    expect(config.enableBackgroundLocation).toBe(true)
    expect(config.enableGeolocation).toBe(true)
    expect(config.enableCamera).toBe(false)
    expect(config.googleServicesFile).toBe('secrets/google-services.json')
    expect(config.enableHealthConnect).toBe(true)
  })

  it('requires a valid package and exactly one web source', () => {
    expect(() => validateAndroidMobileConfig({
      appName: 'WildLoop',
      packageName: 'wildloop',
      url: 'wildloop.org',
    })).toThrow('Invalid Android package name')
    expect(() => validateAndroidMobileConfig({
      appName: 'WildLoop',
      packageName: 'org.wildloop.app',
      url: 'wildloop.org',
      webAssets: 'dist',
    })).toThrow('either android.url or android.webAssets')
  })

  it('allows a bundled offline fallback only for remote applications', () => {
    expect(() => validateAndroidMobileConfig({
      appName: 'WildLoop',
      packageName: 'org.wildloop.app',
      url: 'wildloop.org',
      fallbackWebAssets: 'dist',
    })).not.toThrow()
    expect(() => validateAndroidMobileConfig({
      appName: 'WildLoop',
      packageName: 'org.wildloop.app',
      webAssets: 'dist',
      fallbackWebAssets: 'fallback',
    })).toThrow('fallbackWebAssets requires android.url')
  })

  it('requires Android 8 or newer for Health Connect', () => {
    expect(() => validateAndroidMobileConfig({
      appName: 'WildLoop',
      packageName: 'org.wildloop.app',
      url: 'wildloop.org',
      minSdk: 25,
      capabilities: { healthConnect: true },
    })).toThrow('minSdk 26 or newer')
  })

  it('rejects malformed custom URL schemes', () => {
    expect(() => validateAndroidMobileConfig({
      appName: 'WildLoop',
      packageName: 'org.wildloop.app',
      webAssets: 'dist',
      urlSchemes: ['not a scheme'],
    })).toThrow('Invalid Android URL scheme')
  })
})
