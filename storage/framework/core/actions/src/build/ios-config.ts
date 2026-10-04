import type { IosMobileConfig, MobileConfig } from '@stacksjs/types'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'
import { spotlightActivityTypes } from '@stacksjs/mobile'

export interface CraftIosConfig {
  [key: string]: unknown
  appName: string
  bundleId: string
  version?: string
  buildNumber?: string
  darkMode?: boolean
  appearance?: IosMobileConfig['appearance']
  backgroundColor?: string
  backgroundColorDark?: string
  swipeNavigation?: boolean
  iosVersion?: string
  watchosVersion?: string
  teamId?: string
  devServerURL?: string
  urlSchemes?: string[]
  trustedOrigins?: string[]
  associatedDomains?: string[]
  appGroups?: string[]
  appIconPath?: string
  privacy?: IosMobileConfig['privacy']
  orientations?: IosMobileConfig['orientations']
  deviceFamilies?: IosMobileConfig['deviceFamilies']
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
  liveActivities: 'enableLiveActivities',
  watchApp: 'enableWatchApp',
  backgroundTasks: 'enableBackgroundTasks',
  screenCapture: 'enableScreenCapture',
  pdfViewer: 'enablePDFViewer',
  augmentedReality: 'enableAR',
  machineLearning: 'enableMLKit',
} as const

export function normalizeMobileUrl(value: string | undefined): string | undefined {
  const input = value?.trim()
  if (!input) return undefined
  return new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`).toString().replace(/\/$/, '')
}

export function resolveMobilePath(root: string, value: string | undefined): string | undefined {
  if (!value) return undefined
  return isAbsolute(value) ? value : resolve(root, value)
}

export function toCraftIosConfig(config: IosMobileConfig): CraftIosConfig {
  const devServerURL = normalizeMobileUrl(config.url)
  const trustedOrigins = new Set(config.trustedOrigins ?? [])
  if (devServerURL) trustedOrigins.add(new URL(devServerURL).origin)
  const craft: CraftIosConfig = {
    appName: config.appName,
    bundleId: config.bundleId,
    version: config.version,
    buildNumber: config.buildNumber,
    darkMode: config.darkMode,
    appearance: config.appearance,
    backgroundColor: config.backgroundColor,
    backgroundColorDark: config.backgroundColorDark,
    swipeNavigation: config.swipeNavigation,
    iosVersion: config.deploymentTarget,
    watchosVersion: config.watchDeploymentTarget,
    teamId: config.teamId,
    devServerURL,
    urlSchemes: config.urlSchemes,
    trustedOrigins: [...trustedOrigins],
    associatedDomains: config.associatedDomains,
    appGroups: config.appGroups,
    appIconPath: config.appIcon,
    privacy: config.privacy,
    orientations: config.orientations,
    deviceFamilies: config.deviceFamilies,
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
  const types = spotlightActivityTypes(config.spotlight, config.ios.bundleId)
  const path = join(output, 'Info.plist')
  if (types.length === 0 || !existsSync(path))
    return null

  writeFileSync(path, withActivityTypes(readFileSync(path, 'utf8'), types))
  return types
}
