import { describe, expect, it } from 'bun:test'
import { assertCraftSupportsAndroid, assertCraftSupportsAndroidMapProvider, CRAFT_ANDROID_FLOORS, androidCraftFeatures, toCraftAndroidConfig, validateAndroidMobileConfig } from '../src/build/android-config'

describe('Android mobile build configuration', () => {
  it('requires and forwards the native microphone implementation', () => {
    const config = { appName: 'Voice', packageName: 'training.hq.voice', capabilities: { audioRecording: true } }
    expect(toCraftAndroidConfig(config).enableAudioRecording).toBe(true)
    expect(() => assertCraftSupportsAndroid(config, '0.0.323', 'test')).toThrow('audioRecording')
    expect(() => assertCraftSupportsAndroid(config, '0.0.324', 'test')).not.toThrow()
  })

  it('preserves the native key-free provider without inventing a Google map key', () => {
    const config = { appName: 'Wildloop', packageName: 'org.wildloop.app', renderer: 'native' as const, url: 'https://wildloop.org/feed', nativeScreens: { '/': 'Home' }, mapProvider: 'maplibre' as const }
    const result = toCraftAndroidConfig(config)
    expect(result.mapProvider).toBe('maplibre')
    expect(result).not.toHaveProperty('mapsApiKey')
    expect(() => validateAndroidMobileConfig(config)).not.toThrow()
    expect(() => assertCraftSupportsAndroidMapProvider(config, ['google', 'maplibre'])).not.toThrow()
    expect(() => assertCraftSupportsAndroidMapProvider(config, ['google'])).toThrow('does not advertise native map provider')
    expect(() => assertCraftSupportsAndroidMapProvider(config)).toThrow('published SDK')
    expect(() => validateAndroidMobileConfig({ ...config, renderer: 'web' })).toThrow('configures native map views')
    expect(() => validateAndroidMobileConfig({ ...config, mapProvider: 'unknown' as never })).toThrow('android.mapProvider')
  })

  it('retains the default provider contract for apps without an explicit map choice', () => {
    const config = { appName: 'Existing app', packageName: 'org.example.app' }
    expect(toCraftAndroidConfig(config)).not.toHaveProperty('mapProvider')
    expect(() => assertCraftSupportsAndroidMapProvider(config)).not.toThrow()
  })
  it('forwards bundled font declarations to the Android builder', () => {
    const fonts = { 'Allura-Regular': { src: 'fonts/Allura.ttf', license: 'fonts/OFL.txt' } }
    expect(toCraftAndroidConfig({ appName: 'HQ', packageName: 'training.hq.app', nativeFonts: fonts }).nativeFonts).toEqual(fonts)
  })
  it('passes the native map key through to Craft without changing it', () => {
    const config = {appName:'Wildloop',packageName:'org.wildloop.app',url:'https://wildloop.org/feed',mapsApiKey:'test-android-maps-key'}
    expect(toCraftAndroidConfig(config).mapsApiKey).toBe(config.mapsApiKey)
    expect(toCraftAndroidConfig({...config,mapsApiKey:undefined})).not.toHaveProperty('mapsApiKey')
    expect(() => validateAndroidMobileConfig({...config,mapsApiKey:'  '})).toThrow('android.mapsApiKey')
  })

  it('passes a notification glyph and tint to a Craft that draws them', () => {
    const config = { appName: 'HQ', packageName: 'training.hq.app', url: 'https://hq.training/m', notificationIcon: 'public/notification.xml', notificationColor: '#2F63FF' }
    // The path is resolved against the project by the build, like appIcon.
    expect(toCraftAndroidConfig(config)).toMatchObject({ notificationColor: '#2F63FF' })
    expect(toCraftAndroidConfig(config)).not.toHaveProperty('notificationIconPath')
    expect(toCraftAndroidConfig({ appName: 'HQ', packageName: 'training.hq.app' })).not.toHaveProperty('notificationColor')
    expect(androidCraftFeatures(config)).toContain('notificationIcon')
    expect(() => assertCraftSupportsAndroid(config, '0.0.240', 'test')).toThrow('notificationIcon (needs >= 0.0.241)')
    expect(() => assertCraftSupportsAndroid(config, CRAFT_ANDROID_FLOORS.notificationIcon, 'test')).not.toThrow()
    expect(() => validateAndroidMobileConfig(config)).not.toThrow()
    expect(() => validateAndroidMobileConfig({ ...config, notificationColor: 'blue' })).toThrow('android.notificationColor')
    expect(() => validateAndroidMobileConfig({ ...config, notificationIcon: 'public/icon.svg' })).toThrow('android.notificationIcon')
  })

  it('maps Stacks capabilities onto the Craft Android builder', () => {
    const config = toCraftAndroidConfig({
      appName: 'WildLoop',
      packageName: 'org.wildloop.app',
      url: 'wildloop.org',
      urlSchemes: ['wildloop'],
      appLinks: [{ host: 'wildloop.org', paths: [{ pattern: '/privacy', exclude: true }, { pattern: '/*' }] }],
      googleServicesFile: 'secrets/google-services.json',
      capabilities: { backgroundLocation: true, haptics: true, camera: false, healthConnect: true, localNetwork: true, bluetooth: true, heartRate: true, localDatabase: true, localNotifications: true },
    })
    expect(config.devServerURL).toBe('https://wildloop.org')
    expect(config.trustedOrigins).toEqual(['https://wildloop.org'])
    expect(config.urlSchemes).toEqual(['wildloop'])
    expect(config.appLinks).toEqual([{ host: 'wildloop.org', paths: [{ pattern: '/privacy', exclude: true }, { pattern: '/*' }] }])
    expect(config.enableBackgroundLocation).toBe(true)
    expect(config.enableGeolocation).toBe(true)
    expect(config.enableCamera).toBe(false)
    expect(config.googleServicesFile).toBe('secrets/google-services.json')
    expect(config.enableHealthConnect).toBe(true)
    expect(config.enableBluetooth).toBe(true)
    expect(config.enableHeartRate).toBe(true)
    expect(config.enableLocalNetwork).toBe(true)
    expect(config.enableLocalDatabase).toBe(true)
    expect(config.enableLocalNotifications).toBe(true)
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

  const native = {
    appName: 'HQ',
    packageName: 'training.hq.app',
    url: 'https://hq.training/m',
    renderer: 'native' as const,
    nativeScreens: { '/m': 'Today', '/m/workout/:id': 'Workout' },
    nativeApp: 'resources/native/app.ts',
    tabs: [{ id: '/m', title: 'Today', symbol: 'sun.max' }],
    backgroundRefresh: { enabled: true, minimumIntervalMinutes: 120 },
    healthConnect: { read: ['sleep' as const, 'workouts' as const], write: ['mindful' as const], background: true },
    privacyPolicyUrl: 'https://hq.training/privacy',
    capabilities: { healthConnect: true },
  }

  it('passes the native app shell to Craft, with the app script under its bundle route', () => {
    const config = toCraftAndroidConfig(native)
    expect(config.renderer).toBe('native')
    expect(config.nativeScreens).toEqual(native.nativeScreens)
    expect(config.nativeApp).toBe('__app')
    expect(config.tabs).toEqual(native.tabs)
    expect(config.backgroundRefresh).toEqual(native.backgroundRefresh)
    expect(config.healthConnect).toEqual(native.healthConnect)
    expect(config.privacyPolicyURL).toBe('https://hq.training/privacy')
    // A web-view app keeps none of it.
    const web = toCraftAndroidConfig({ ...native, renderer: 'web', nativeApp: undefined })
    expect(web.nativeScreens).toBeUndefined()
    expect(web.tabs).toBeUndefined()
    expect('nativeApp' in web).toBe(false)
  })

  it('validates a native app the way ios.renderer is validated', () => {
    expect(() => validateAndroidMobileConfig(native)).not.toThrow()
    expect(() => validateAndroidMobileConfig({ ...native, nativeScreens: {} })).toThrow('list them in android.nativeScreens')
    expect(() => validateAndroidMobileConfig({ ...native, webAssets: 'dist' })).toThrow('has no web view')
    expect(() => validateAndroidMobileConfig({ ...native, tabs: [{ id: 'm', title: 'Today' }] })).toThrow('an app path')
    expect(() => validateAndroidMobileConfig({ ...native, backgroundRefresh: { enabled: true, minimumIntervalMinutes: 5 } })).toThrow('at least 15')
    expect(() => validateAndroidMobileConfig({ ...native, capabilities: {} })).toThrow('capabilities.healthConnect is off')
    expect(() => validateAndroidMobileConfig({ appName: 'A', packageName: 'a.b', url: 'a.b', nativeApp: 'app.ts' })).toThrow('runs beside native screens')
  })

  it('refuses a Craft that would build the app without its shell, Health Connect or background refresh', () => {
    expect(androidCraftFeatures(native)).toEqual(['nativeShell', 'healthConnect', 'backgroundRefresh'])
    expect(androidCraftFeatures(native, { appBundle: true })).toContain('appBundle')
    expect(() => assertCraftSupportsAndroid(native, '0.0.164', '/x/package.json')).toThrow(`needs >= ${CRAFT_ANDROID_FLOORS.nativeShell}`)
    expect(() => assertCraftSupportsAndroid(native, CRAFT_ANDROID_FLOORS.nativeShell, '/x/package.json')).not.toThrow()
    // A web-view app has nothing floored.
    expect(() => assertCraftSupportsAndroid({ appName: 'A', packageName: 'a.b', url: 'a.b' }, '0.0.100', '/x/package.json')).not.toThrow()
  })
})

it('requires the Android generic Bluetooth transport when requested', () => {
  const config = { appName: 'HQ', packageName: 'training.hq.app', url: 'https://hq.training/m', capabilities: { bluetooth: true } }
  expect(() => assertCraftSupportsAndroid(config, '0.0.177', 'old builder')).toThrow('bluetooth')
  expect(() => assertCraftSupportsAndroid(config, '0.0.178', 'new builder')).not.toThrow()
})

it('passes heart-rate straps through and refuses a Craft without them on Android', () => {
  const config = { appName: 'HQ', packageName: 'training.hq.app', url: 'https://hq.training/m', capabilities: { bluetooth: true, heartRate: true } }
  expect(androidCraftFeatures(config)).toContain('heartRate')
  expect(() => assertCraftSupportsAndroid(config, '0.0.246', 'old builder')).toThrow('heartRate (needs >= 0.0.247)')
  expect(() => assertCraftSupportsAndroid(config, CRAFT_ANDROID_FLOORS.heartRate, 'new builder')).not.toThrow()
})


it('refuses a Craft release that cannot verify HTTPS App Links', () => {
  const config = { appName: 'HQ', packageName: 'training.hq.app', appLinks: [{ host: 'hq.training' }], capabilities: { deepLinks: true } }
  expect(() => assertCraftSupportsAndroid(config, '0.0.200', 'fixture')).toThrow('appLinks')
  expect(() => assertCraftSupportsAndroid(config, '0.0.201', 'fixture')).not.toThrow()
})
