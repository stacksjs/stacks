import type { IosMobileConfig } from '@stacksjs/types'
import { isAbsolute, resolve } from 'node:path'

export interface CraftIosConfig {
  [key: string]: unknown
  appName: string
  bundleId: string
  version?: string
  buildNumber?: string
  darkMode?: boolean
  backgroundColor?: string
  iosVersion?: string
  teamId?: string
  devServerURL?: string
  urlSchemes?: string[]
  trustedOrigins?: string[]
  associatedDomains?: string[]
  appGroups?: string[]
  appIconPath?: string
  privacy?: IosMobileConfig['privacy']
  orientations?: IosMobileConfig['orientations']
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
    backgroundColor: config.backgroundColor,
    iosVersion: config.deploymentTarget,
    teamId: config.teamId,
    devServerURL,
    urlSchemes: config.urlSchemes,
    trustedOrigins: [...trustedOrigins],
    associatedDomains: config.associatedDomains,
    appGroups: config.appGroups,
    appIconPath: config.appIcon,
    privacy: config.privacy,
    orientations: config.orientations,
  }

  for (const [key, nativeKey] of Object.entries(CAPABILITY_KEYS)) {
    const enabled = config.capabilities?.[key as keyof typeof CAPABILITY_KEYS]
    if (enabled !== undefined) craft[nativeKey] = enabled
  }
  if (config.capabilities?.backgroundLocation) craft.enableGeolocation = true

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
}
