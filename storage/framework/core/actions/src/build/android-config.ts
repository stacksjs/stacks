import type { AndroidMobileConfig } from '@stacksjs/types'
import { NATIVE_APP_ROUTE, normalizeMobileUrl, toCraftCrashReporting } from './ios-config'

export interface CraftAndroidConfig {
  [key: string]: unknown
  nativeFonts?: AndroidMobileConfig['nativeFonts']
  appName: string
  packageName: string
  version?: string
  versionCode?: number
  minSdk?: number
  targetSdk?: number
  darkMode?: boolean
  appearance?: AndroidMobileConfig['appearance']
  backgroundColor?: string
  backgroundColorDark?: string
  devServerURL?: string
  trustedOrigins?: string[]
  urlSchemes?: string[]
  appLinks?: AndroidMobileConfig['appLinks']
  appIconPath?: string
  googleServicesFile?: string
  enableBluetooth?: boolean
  enableHealthConnect?: boolean
  renderer?: AndroidMobileConfig['renderer']
  nativeScreens?: Record<string, string>
  /** The bundle route the app script runs under (stx's `__app`). */
  nativeApp?: string
  tabs?: AndroidMobileConfig['tabs']
  backgroundRefresh?: AndroidMobileConfig['backgroundRefresh']
  healthConnect?: AndroidMobileConfig['healthConnect']
  privacyPolicyURL?: string
}

const CAPABILITY_KEYS = {
  speechRecognition: 'enableSpeechRecognition',
  haptics: 'enableHaptics',
  share: 'enableShare',
  camera: 'enableCamera',
  biometric: 'enableBiometric',
  pushNotifications: 'enablePushNotifications',
  secureStorage: 'enableSecureStorage',
  geolocation: 'enableGeolocation',
  backgroundLocation: 'enableBackgroundLocation',
  keepAwake: 'enableKeepAwake',
  deepLinks: 'enableDeepLinks',
  healthConnect: 'enableHealthConnect',
  bluetooth: 'enableBluetooth',
  localNetwork: 'enableLocalNetwork',
} as const

/**
 * The first craft-native release whose Android template honours a feature
 * of `config/mobile.ts`'s android section, the Android sibling of
 * ios-config.ts's CRAFT_CAPABILITY_FLOORS. An older template copies the
 * keys into craft.config.json and has no Kotlin reading them: the build
 * succeeds and the app opens one bare screen, with no tabs, no Health
 * Connect reads and no background refresh.
 */
export const CRAFT_ANDROID_FLOORS = {
  /** The native app shell: tabs, paths to screens, the app script, synchronous stores. */
  nativeShell: '0.0.169',
  /** Verified HTTPS hosts and ordered website path exclusions. */
  appLinks: '0.0.201',
  bluetooth: '0.0.178',
  /** Health Connect for native screens (workouts, sleep, heart rate, mindful, nutrition). */
  healthConnect: '0.0.169',
  /** WorkManager background refresh for the app script. */
  backgroundRefresh: '0.0.169',
  /** `bundleRelease` (an AAB for Google Play) and release signing from the environment. */
  appBundle: '0.0.169',
  /** CraftCrashReporter.kt: uncaught exceptions, ANRs, JavaScript errors, the outbox. */
  crashReporting: '0.0.179',
} as const

export type AndroidCraftFeature = keyof typeof CRAFT_ANDROID_FLOORS

/** Which floored features this android config uses. */
export function androidCraftFeatures(config: AndroidMobileConfig, options: { appBundle?: boolean } = {}): AndroidCraftFeature[] {
  const features: AndroidCraftFeature[] = []
  if (config.renderer === 'native' && Object.keys(config.nativeScreens ?? {}).length) features.push('nativeShell')
  if (config.appLinks?.length && config.capabilities?.deepLinks) features.push('appLinks')
  if (config.capabilities?.bluetooth) features.push('bluetooth')
  if (config.capabilities?.healthConnect && config.renderer === 'native') features.push('healthConnect')
  if (config.backgroundRefresh?.enabled) features.push('backgroundRefresh')
  if (options.appBundle) features.push('appBundle')
  if (config.crashReporting?.key) features.push('crashReporting')
  return features
}

/** Refuse to generate an app the resolved Craft would build without what config/mobile.ts asks for. */
export function assertCraftSupportsAndroid(config: AndroidMobileConfig, version: string, source: string, options: { appBundle?: boolean } = {}): void {
  const missing = androidCraftFeatures(config, options)
    .filter(feature => !Bun.semver.satisfies(version, `>=${CRAFT_ANDROID_FLOORS[feature]}`))
  if (!missing.length) return
  const needed = missing.map(feature => CRAFT_ANDROID_FLOORS[feature]).reduce((max, next) => (Bun.semver.order(next, max) > 0 ? next : max), '0.0.0')
  throw new Error(
    `The Craft Android builder is craft-native ${version} (${source}), which would build the app without `
    + `${missing.map(feature => `${feature} (needs >= ${CRAFT_ANDROID_FLOORS[feature]})`).join(', ')}. `
    + `Install craft-native >= ${needed}: look for an older copy nested under @stacksjs/mobile in bun.lock, `
    + 'or raise the app\'s own craft-native pin.',
  )
}

export function toCraftAndroidConfig(config: AndroidMobileConfig): CraftAndroidConfig {
  const devServerURL = normalizeMobileUrl(config.url)
  const trustedOrigins = new Set(config.trustedOrigins ?? [])
  if (devServerURL) trustedOrigins.add(new URL(devServerURL).origin)
  const native = config.renderer === 'native'
  const craft: CraftAndroidConfig = {
    nativeFonts: config.nativeFonts,
    appName: config.appName,
    packageName: config.packageName,
    version: config.version,
    versionCode: config.versionCode,
    minSdk: config.minSdk,
    targetSdk: config.targetSdk,
    darkMode: config.darkMode,
    appearance: config.appearance,
    backgroundColor: config.backgroundColor,
    backgroundColorDark: config.backgroundColorDark,
    devServerURL,
    trustedOrigins: [...trustedOrigins],
    urlSchemes: config.urlSchemes,
    appLinks: config.appLinks,
    appIconPath: config.appIcon,
    googleServicesFile: config.googleServicesFile,
    renderer: config.renderer,
    nativeScreens: native ? config.nativeScreens : undefined,
    nativeApp: native && config.nativeApp ? NATIVE_APP_ROUTE : undefined,
    tabs: native ? config.tabs : undefined,
    backgroundRefresh: native ? config.backgroundRefresh : undefined,
    healthConnect: config.capabilities?.healthConnect ? config.healthConnect : undefined,
    privacyPolicyURL: config.privacyPolicyUrl,
    crashReporting: toCraftCrashReporting(config.crashReporting),
  }
  for (const [key, nativeKey] of Object.entries(CAPABILITY_KEYS)) {
    const enabled = config.capabilities?.[key as keyof typeof CAPABILITY_KEYS]
    if (enabled !== undefined) craft[nativeKey] = enabled
  }
  if (config.capabilities?.backgroundLocation) craft.enableGeolocation = true
  // Unset options are left out, so Craft's defaults stand.
  for (const key of Object.keys(craft)) {
    if (craft[key] === undefined) delete craft[key]
  }
  return craft
}

export function validateAndroidMobileConfig(config: AndroidMobileConfig): void {
  if (!config.appName?.trim()) throw new Error('config/mobile.ts must define android.appName')
  if (!/^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/.test(config.packageName)) {
    throw new Error(`Invalid Android package name: ${config.packageName}`)
  }
  if (config.renderer !== undefined && config.renderer !== 'web' && config.renderer !== 'native')
    throw new Error(`android.renderer must be 'web' or 'native', not ${String(config.renderer)}`)
  if (config.renderer === 'native') {
    if (!Object.keys(config.nativeScreens ?? {}).length)
      throw new Error('android.renderer \'native\' draws every screen natively: list them in android.nativeScreens')
    if (config.webAssets)
      throw new Error('android.renderer \'native\' has no web view to show android.webAssets in: set android.url to the app\'s site instead')
    if (config.fallbackWebAssets)
      throw new Error('android.fallbackWebAssets is the web view\'s offline page; android.renderer \'native\' has no web view')
    if (!config.url) throw new Error('android.renderer \'native\' needs android.url: the app\'s site, where its API answers')
  }
  else {
    if (config.url && config.webAssets) throw new Error('Choose either android.url or android.webAssets in config/mobile.ts, not both')
    if (!config.url && !config.webAssets) throw new Error('config/mobile.ts must define android.url or android.webAssets')
    if (config.fallbackWebAssets && !config.url) throw new Error('android.fallbackWebAssets requires android.url')
  }
  if (config.nativeApp && config.renderer !== 'native')
    throw new Error('android.nativeApp runs beside native screens: set android.renderer to \'native\'')
  for (const tab of config.tabs ?? []) {
    if (!tab.id?.startsWith('/')) throw new Error(`An android.tabs entry needs an id that is an app path, like /m (got ${String(tab.id)})`)
  }
  if (config.url) {
    const normalized = normalizeMobileUrl(config.url)
    const url = new URL(normalized!)
    const isLocal = ['localhost', '127.0.0.1', '10.0.2.2'].includes(url.hostname)
    if (url.protocol !== 'https:' && !isLocal) throw new Error('android.url must use HTTPS outside local development')
  }
  if (config.capabilities?.healthConnect && (config.minSdk ?? 26) < 26) {
    throw new Error('Android Health Connect requires android.minSdk 26 or newer')
  }
  if (config.healthConnect && !config.capabilities?.healthConnect)
    throw new Error('android.healthConnect lists Health Connect data, but android.capabilities.healthConnect is off')
  const minutes = config.backgroundRefresh?.minimumIntervalMinutes
  if (minutes !== undefined && (!Number.isFinite(minutes) || minutes < 15))
    throw new Error('android.backgroundRefresh.minimumIntervalMinutes is at least 15 (WorkManager\'s shortest period)')
  for (const scheme of config.urlSchemes ?? []) {
    if (!/^[a-z][a-z0-9+.-]*$/i.test(scheme)) throw new Error(`Invalid Android URL scheme: ${scheme}`)
  }
}

/** The release an Android build's events name, and so the one its R8 mapping is stored under. */
export function androidRelease(config: Pick<AndroidMobileConfig, 'version' | 'versionCode' | 'crashReporting'>): string {
  if (config.crashReporting?.release) return config.crashReporting.release
  const version = config.version || '1.0.0'
  return `${version}+${config.versionCode || 1}`
}

/**
 * Upload a release build's R8 mapping to bughq, so its obfuscated crash
 * frames retrace. Needs the secret `BUGHQ_UPLOAD_TOKEN` in the build's
 * environment. Answers what happened, and never throws: a missing upload must
 * not fail a release build.
 */
export async function uploadAndroidMapping(mappingPath: string, host: string, release: string, token: string | undefined, send: typeof fetch = fetch): Promise<{ ok: boolean, message: string }> {
  if (!token) return { ok: false, message: 'BUGHQ_UPLOAD_TOKEN is not set, so the R8 mapping was not uploaded and this build\'s Android crashes will show obfuscated names.' }
  const file = Bun.file(mappingPath)
  if (!(await file.exists())) return { ok: false, message: `No R8 mapping at ${mappingPath}, so nothing was uploaded.` }
  try {
    const body = Bun.gzipSync(new Uint8Array(await file.arrayBuffer()))
    const response = await send(`${host.replace(/\/$/, '')}/api/debug-files?kind=proguard&release=${encodeURIComponent(release)}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/octet-stream' },
      body,
    })
    if (!response.ok) return { ok: false, message: `bughq refused the R8 mapping (${response.status}): ${(await response.text()).slice(0, 200)}` }
    return { ok: true, message: `Uploaded the R8 mapping for ${release} to bughq.` }
  }
  catch (error) {
    return { ok: false, message: `Could not upload the R8 mapping: ${error instanceof Error ? error.message : String(error)}` }
  }
}

