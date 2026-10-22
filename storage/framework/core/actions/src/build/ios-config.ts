import type { IosMobileConfig, MobileConfig, MobileCrashReportingConfig } from '@stacksjs/types'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { spotlightActivityTypes } from '@stacksjs/mobile'
import { nativeScreenRoutes } from './native-screens'

export interface CraftIosConfig {
  [key: string]: unknown
  nativeFonts?: IosMobileConfig['nativeFonts']
  appName: string
  bundleId: string
  version?: string
  buildNumber?: string
  darkMode?: boolean
  appearance?: IosMobileConfig['appearance']
  backgroundColor?: string
  backgroundColorDark?: string
  swipeNavigation?: boolean
  allowsLinkPreview?: boolean
  keyboardAccessory?: boolean
  disableZoom?: boolean
  splashMaxSeconds?: number
  requestTimeoutSeconds?: number
  backgroundRefresh?: IosMobileConfig['backgroundRefresh']
  iosVersion?: string
  watchosVersion?: string
  teamId?: string
  devServerURL?: string
  urlSchemes?: string[]
  trustedOrigins?: string[]
  appBoundDomains?: string[]
  limitNavigationsToAppBoundDomains?: boolean
  associatedDomains?: string[]
  renderer?: IosMobileConfig['renderer']
  nativeScreens?: Record<string, string>
  nativeBundle?: string
  /** The bundle route the app script runs under (stx's `__app`). */
  nativeApp?: string
  nativeScriptThread?: IosMobileConfig['nativeScriptThread']
  tabs?: IosMobileConfig['tabs']
  shareStorage?: Record<string, string>
  appGroups?: string[]
  appIconPath?: string
  splashImagePath?: string
  splashImagePathDark?: string
  privacy?: IosMobileConfig['privacy']
  usageDescriptions?: Record<string, string>
  orientations?: IosMobileConfig['orientations']
  deviceFamilies?: IosMobileConfig['deviceFamilies']
}

/** The route stx's bundle runs the app script under (`compileNativeBundle`'s `app`). */
export const NATIVE_APP_ROUTE = '__app'

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
  clipboard: 'enableClipboard',
  contacts: 'enableContacts',
  calendar: 'enableCalendar',
  localNotifications: 'enableLocalNotifications',
  inAppPurchase: 'enableInAppPurchase',
  keepAwake: 'enableKeepAwake',
  orientationLock: 'enableOrientationLock',
  deepLinks: 'enableDeepLinks',
  qrScanner: 'enableQRScanner',
  localNetwork: 'enableLocalNetwork',
  filePicker: 'enableFilePicker',
  fileDownload: 'enableFileDownload',
  socialAuth: 'enableSocialAuth',
  audioRecording: 'enableAudioRecording',
  videoRecording: 'enableVideoRecording',
  motionSensors: 'enableMotionSensors',
  localDatabase: 'enableLocalDatabase',
  bluetooth: 'enableBluetooth',
  nfc: 'enableNFC',
  healthKit: 'enableHealthKit',
  appleMusic: 'enableAppleMusic',
  heartRate: 'enableHeartRate',
  backgroundAudio: 'enableBackgroundAudio',
  scheduledWorkouts: 'enableScheduledWorkouts',
  liveActivities: 'enableLiveActivities',
  watchApp: 'enableWatchApp',
  backgroundTasks: 'enableBackgroundTasks',
  screenCapture: 'enableScreenCapture',
  pdfViewer: 'enablePDFViewer',
  augmentedReality: 'enableAR',
  machineLearning: 'enableMLKit',
} as const

/**
 * The first craft-native release whose iOS template honours a capability.
 *
 * Craft copies every `enable…` key into craft.config.json, and an older
 * template simply has no Swift reading the new one: the build succeeds and
 * the app ships without the entitlement, the Info.plist keys and the bridge,
 * while the pages still call it. HQ.training's Apple Watch workouts went
 * missing that way, built by a craft-native 0.0.162 nested under
 * @stacksjs/mobile. Capabilities older than every craft-native Stacks has
 * accepted are not listed.
 */
export const CRAFT_CAPABILITY_FLOORS = {
  appleMusic: '0.0.144',
  heartRate: '0.0.152',
  backgroundAudio: '0.0.162',
  scheduledWorkouts: '0.0.163',
} as const satisfies Partial<Record<keyof typeof CAPABILITY_KEYS, string>>

export interface UnsupportedCraftCapability {
  capability: keyof typeof CRAFT_CAPABILITY_FLOORS
  needs: string
}

/** The capabilities `config/mobile.ts` turns on that a Craft of `version` would leave out of the app. */
export function unsupportedCraftCapabilities(capabilities: IosMobileConfig['capabilities'], version: string): UnsupportedCraftCapability[] {
  const missing: UnsupportedCraftCapability[] = []
  for (const [capability, needs] of Object.entries(CRAFT_CAPABILITY_FLOORS) as [keyof typeof CRAFT_CAPABILITY_FLOORS, string][]) {
    if (capabilities?.[capability] && !Bun.semver.satisfies(version, `>=${needs}`)) missing.push({ capability, needs })
  }
  return missing
}

/**
 * Refuse to generate an app that would silently lack a capability it asks for.
 *
 * `version` is the craft-native the builder came from and `source` where it
 * was found, both named in the error so the stale copy can be traced in the
 * lockfile.
 */
export function assertCraftSupportsCapabilities(capabilities: IosMobileConfig['capabilities'], version: string, source: string): void {
  const missing = unsupportedCraftCapabilities(capabilities, version)
  if (missing.length === 0) return
  const needed = missing.reduce((max, { needs }) => (Bun.semver.order(needs, max) > 0 ? needs : max), '0.0.0')
  throw new Error(
    `The Craft iOS builder is craft-native ${version} (${source}), which would build the app without `
    + `${missing.map(({ capability, needs }) => `ios.capabilities.${capability} (needs >= ${needs})`).join(', ')}. `
    + `Install craft-native >= ${needed}: look for an older copy nested under @stacksjs/mobile in bun.lock, `
    + 'or raise the app\'s own craft-native pin.',
  )
}

/** The first craft-native whose iOS and Android shells report crashes (CraftCrashReporter). */
export const CRAFT_CRASH_REPORTING_FLOOR = '0.0.179'

/**
 * The crash reporting a platform builds with: the shared `crashReporting`,
 * overridden field by field by the platform's own. Undefined, and so off,
 * without a key.
 */
export function resolveCrashReporting(shared: MobileCrashReportingConfig | undefined, platform: MobileCrashReportingConfig | undefined): MobileCrashReportingConfig | undefined {
  // An empty string is unset (an env var left blank), so it never hides the
  // shared value under it.
  const set = (config: MobileCrashReportingConfig | undefined) =>
    Object.fromEntries(Object.entries(config ?? {}).filter(([, value]) => value !== undefined && value !== '')) as MobileCrashReportingConfig
  const merged: MobileCrashReportingConfig = { ...set(shared), ...set(platform) }
  if (!merged.key?.trim()) return undefined
  if (merged.host) {
    const url = new URL(normalizeMobileUrl(merged.host)!)
    const local = ['localhost', '127.0.0.1', '::1', '10.0.2.2'].includes(url.hostname)
    if (url.protocol !== 'https:' && !local) throw new Error('crashReporting.host must use HTTPS outside local development')
    merged.host = url.origin
  }
  return merged
}

/** What craft.config.json carries: the runtime settings, not the build-only ones. */
export function toCraftCrashReporting(config: MobileCrashReportingConfig | undefined): Record<string, unknown> | undefined {
  if (!config?.key) return undefined
  const craft: Record<string, unknown> = { key: config.key, host: config.host, environment: config.environment, release: config.release, sessions: config.sessions }
  for (const key of Object.keys(craft)) {
    if (craft[key] === undefined) delete craft[key]
  }
  return craft
}

/** Refuse a build whose Craft would silently leave crash reporting out. */
export function assertCraftSupportsCrashReporting(config: MobileCrashReportingConfig | undefined, version: string, source: string): void {
  if (!config?.key || Bun.semver.satisfies(version, `>=${CRAFT_CRASH_REPORTING_FLOOR}`)) return
  throw new Error(
    `The Craft builder is craft-native ${version} (${source}), which would build the app without crash reporting `
    + `(crashReporting needs >= ${CRAFT_CRASH_REPORTING_FLOOR}). Install craft-native >= ${CRAFT_CRASH_REPORTING_FLOOR}: `
    + 'look for an older copy nested under @stacksjs/mobile in bun.lock, or raise the app\'s own craft-native pin.',
  )
}

export function normalizeMobileUrl(value: string | undefined): string | undefined {
  const input = value?.trim()
  if (!input) return undefined
  return new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`).toString().replace(/\/$/, '')
}

/**
 * The generated project's records (craft.config.json, stacks-mobile.json)
 * with every file path inside the app written relative to the project folder.
 * They are committed for CI builds, and an absolute path named the machine
 * that generated them: each developer's build rewrote every icon and splash
 * path, and the diff said nothing about the app.
 */
export function portablePaths<T>(value: T, projectDir: string, appRoot: string): T {
  if (typeof value === 'string')
    return (isAbsolute(value) && !relative(appRoot, value).startsWith('..') ? relative(projectDir, value) || '.' : value) as T
  if (Array.isArray(value))
    return value.map(item => portablePaths(item, projectDir, appRoot)) as T
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value))
      out[key] = typeof item === 'string' && !/(?:path(?:dark)?|bundle)$|^(?:src|license)$/i.test(key) ? item : portablePaths(item, projectDir, appRoot)
    return out as T
  }
  return value
}

export function resolveMobilePath(root: string, value: string | undefined): string | undefined {
  if (!value) return undefined
  return isAbsolute(value) ? value : resolve(root, value)
}

/**
 * Whether WebKit's own edge swipe goes back through history.
 *
 * Off unless asked for: the stx router swipes back itself, dragging the
 * previous screen in under the finger, and with WebKit's gesture on as well
 * the two fought over every edge swipe. `swipeBack` names who answers it; an
 * explicit `swipeNavigation` still wins, for an app that set it before.
 */
export function resolveSwipeNavigation(config: Pick<IosMobileConfig, 'swipeBack' | 'swipeNavigation'>): boolean {
  if (config.swipeNavigation !== undefined) return config.swipeNavigation
  return config.swipeBack === 'webview'
}

export function toCraftIosConfig(config: IosMobileConfig): CraftIosConfig {
  const devServerURL = normalizeMobileUrl(config.url)
  const trustedOrigins = new Set(config.trustedOrigins ?? [])
  if (devServerURL) trustedOrigins.add(new URL(devServerURL).origin)

  // An app that lists app-bound domains has asked for the app-bound model, and
  // the restriction is what actually grants it: without the limit the plist
  // key changes nothing and service workers never register
  // (stacksjs/stacks#2878). So declaring them turns it on, and an explicit
  // `false` below still wins for an app that navigates off its own domains.
  //
  // Deliberately keyed on `appBoundDomains` alone and not on
  // `trustedOrigins`, which this function seeds from `config.url` for every
  // app: Craft derives app-bound domains from those when none are declared,
  // so keying on them would confine every Craft web view rather than the ones
  // that asked for it. `appBoundDomains: []` declares none, so it stays off.
  const declaresAppBoundDomains = (config.appBoundDomains?.length ?? 0) > 0
  const craft: CraftIosConfig = {
    nativeFonts: config.nativeFonts,
    appName: config.appName,
    bundleId: config.bundleId,
    version: config.version,
    buildNumber: config.buildNumber,
    darkMode: config.darkMode,
    appearance: config.appearance,
    backgroundColor: config.backgroundColor,
    backgroundColorDark: config.backgroundColorDark,
    swipeNavigation: resolveSwipeNavigation(config),
    allowsLinkPreview: config.allowsLinkPreview,
    keyboardAccessory: config.keyboardAccessory,
    disableZoom: config.disableZoom,
    splashMaxSeconds: config.splashMaxSeconds,
    requestTimeoutSeconds: config.requestTimeoutSeconds,
    backgroundRefresh: config.backgroundRefresh,
    iosVersion: config.deploymentTarget,
    watchosVersion: config.watchDeploymentTarget,
    teamId: config.teamId,
    devServerURL,
    urlSchemes: config.urlSchemes,
    appShortcuts: config.appShortcuts,
    trustedOrigins: [...trustedOrigins],
    appBoundDomains: config.appBoundDomains,
    limitNavigationsToAppBoundDomains: config.limitNavigationsToAppBoundDomains ?? (declaresAppBoundDomains || undefined),
    associatedDomains: config.associatedDomains,
    renderer: config.renderer,
    nativeScreens: nativeScreenRoutes(config),
    nativeApp: config.nativeApp ? NATIVE_APP_ROUTE : undefined,
    nativeScriptThread: config.nativeScriptThread,
    tabs: config.tabs,
    shareStorage: config.shareStorage,
    appGroups: config.appGroups,
    appIconPath: config.appIcon,
    privacy: config.privacy,
    usageDescriptions: config.usageDescriptions,
    orientations: config.orientations,
    deviceFamilies: config.deviceFamilies,
    crashReporting: toCraftCrashReporting(config.crashReporting),
  }

  for (const [key, nativeKey] of Object.entries(CAPABILITY_KEYS)) {
    const enabled = config.capabilities?.[key as keyof typeof CAPABILITY_KEYS]
    if (enabled !== undefined) craft[nativeKey] = enabled
  }
  if (config.capabilities?.backgroundLocation) craft.enableGeolocation = true

  // An option the app left unset is left out, not sent as undefined. Craft
  // releases before 0.0.101 let an undefined `darkMode` erase their default,
  // and the iOS app then could not read its config at all.
  for (const key of Object.keys(craft)) {
    if (craft[key] === undefined) delete craft[key]
  }

  return craft
}

export function validateIosMobileConfig(config: IosMobileConfig): void {
  if (!config.appName?.trim()) throw new Error('config/mobile.ts must define ios.appName')
  if (!/^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(config.bundleId)) {
    throw new Error(`Invalid iOS bundle identifier: ${config.bundleId}`)
  }
  if (config.url && config.webAssets) {
    throw new Error('Choose either ios.url or ios.webAssets in config/mobile.ts, not both')
  }
  if (!config.url && !config.webAssets) {
    throw new Error('config/mobile.ts must define ios.url or ios.webAssets')
  }
  if (config.renderer !== undefined && config.renderer !== 'web' && config.renderer !== 'native')
    throw new Error(`ios.renderer must be 'web' or 'native', not ${String(config.renderer)}`)
  if (config.renderer === 'native') {
    // No web view: every path is a screen, and the site is only where the
    // API and the pages opened in the in-app browser live.
    if (!Object.keys(config.nativeScreens ?? {}).length)
      throw new Error('ios.renderer \'native\' draws every screen natively: list them in ios.nativeScreens')
    if (config.webAssets)
      throw new Error('ios.renderer \'native\' has no web view to show ios.webAssets in: set ios.url to the app\'s site instead')
    if (config.fallbackWebAssets)
      throw new Error('ios.fallbackWebAssets is the web view\'s offline page; ios.renderer \'native\' has no web view')
  }
  if (config.fallbackWebAssets && !config.url) {
    throw new Error('ios.fallbackWebAssets requires ios.url')
  }
  if (config.deviceFamilies && (config.deviceFamilies.length === 0 || config.deviceFamilies.some(family => family !== 'iphone' && family !== 'ipad'))) {
    throw new Error('ios.deviceFamilies must contain iphone and/or ipad')
  }
  if (config.url) {
    const url = new URL(normalizeMobileUrl(config.url)!)
    const isLocal = ['localhost', '127.0.0.1', '::1'].includes(url.hostname)
    if (url.protocol !== 'https:' && !isLocal) throw new Error('ios.url must use HTTPS outside local development')
  }
  for (const domain of config.associatedDomains ?? []) {
    if (!/^(applinks|webcredentials|activitycontinuation):[^/\s]+$/.test(domain)) {
      throw new Error(`Invalid iOS associated domain: ${domain}`)
    }
  }
  for (const key of ['splashMaxSeconds', 'requestTimeoutSeconds'] as const) {
    const value = config[key]
    if (value !== undefined && (!Number.isFinite(value) || value <= 0)) throw new Error(`ios.${key} must be a positive number of seconds`)
  }
  const refresh = config.backgroundRefresh
  if (refresh) {
    if (refresh.identifier !== undefined && !/^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(refresh.identifier))
      throw new Error(`Invalid iOS background refresh identifier: ${refresh.identifier}`)
    if (refresh.minimumIntervalMinutes !== undefined && (!Number.isFinite(refresh.minimumIntervalMinutes) || refresh.minimumIntervalMinutes <= 0))
      throw new Error('ios.backgroundRefresh.minimumIntervalMinutes must be a positive number of minutes')
  }
  if (config.capabilities?.watchApp) {
    const target = Number.parseFloat(config.watchDeploymentTarget ?? '9.0')
    if (!Number.isFinite(target) || target < 9) throw new Error('ios.watchDeploymentTarget must be watchOS 9.0 or newer')
  }
}

/**
 * The `NSUserActivityTypes` entry in a generated `Info.plist`.
 *
 * iOS hands a tapped `NSUserActivity` back only to an app whose `Info.plist`
 * lists that activity's type, and the list is fixed at build time. Undeclared,
 * an app's donated Spotlight and Siri entries still appear and a tap on one
 * merely opens the app on whatever screen it was last on — which looks like
 * the feature working until somebody taps a result.
 *
 * Craft's template carries no such key, so the build writes it from
 * `config/mobile.ts`.
 */
const ACTIVITY_TYPES_BLOCK = /[ \t]*<key>NSUserActivityTypes<\/key>\s*<array>[\s\S]*?<\/array>\n?/

export function withActivityTypes(plist: string, types: readonly string[]): string {
  const entries = types.map(type => `        <string>${escapeXml(type)}</string>`).join('\n')
  const block = types.length === 0
    ? ''
    : `    <key>NSUserActivityTypes</key>\n    <array>\n${entries}\n    </array>\n`

  if (ACTIVITY_TYPES_BLOCK.test(plist))
    return plist.replace(ACTIVITY_TYPES_BLOCK, block)
  if (block === '')
    return plist

  const close = plist.lastIndexOf('</dict>')
  if (close < 0)
    throw new Error('Info.plist has no root dictionary to declare activity types in')

  return plist.slice(0, close) + block + plist.slice(close)
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Declare the app's donated activity types in the project just generated.
 *
 * Returns the types written, or null where there is no plist to write them
 * into — a project generated somewhere else, or a build that stopped early.
 * Run after the Craft builder, which writes `Info.plist` from its template on
 * every build; xcodegen only references that file, so regenerating the project
 * afterwards keeps what this wrote.
 */
export function writeIosActivityTypes(output: string, config: MobileConfig): string[] | null {
  const types = [...new Set([...spotlightActivityTypes(config.spotlight, config.ios.bundleId), ...(config.ios.appShortcuts ?? []).map(shortcut => `${config.ios.bundleId}.${shortcut.id}`)])]
  const path = join(output, 'Info.plist')
  if (types.length === 0 || !existsSync(path))
    return null

  writeFileSync(path, withActivityTypes(readFileSync(path, 'utf8'), types))
  return types
}

/** Resolve font files against the app, before the builder writes its project. */
export function resolveNativeFonts(fonts: IosMobileConfig['nativeFonts'], root: string): IosMobileConfig['nativeFonts'] {
  if (!fonts) return undefined
  return Object.fromEntries(Object.entries(fonts).map(([family, file]) => [family, {
    src: resolve(root, file.src),
    ...(file.license ? { license: resolve(root, file.license) } : {}),
  }]))
}

export const CRAFT_NATIVE_FONTS_FLOOR = '0.0.229'

export function assertCraftSupportsAppShortcuts(shortcuts: IosMobileConfig['appShortcuts'], version?: string): void {
  if (!shortcuts?.length) return
  if (version && Bun.semver.satisfies(version, '>=0.0.237')) return
  throw new Error('appShortcuts needs craft-native >= 0.0.237; install a published version that generates App Intents.')
}

/** Older builders would silently omit the fonts and draw system text instead. */
export function assertCraftSupportsNativeFonts(fonts: IosMobileConfig['nativeFonts'], version?: string): void {
  if (!Object.keys(fonts ?? {}).length) return
  if (version && Bun.semver.satisfies(version, `>=${CRAFT_NATIVE_FONTS_FLOOR}`)) return
  throw new Error(`nativeFonts needs craft-native >= ${CRAFT_NATIVE_FONTS_FLOOR}; install a published version that bundles native fonts.`)
}
