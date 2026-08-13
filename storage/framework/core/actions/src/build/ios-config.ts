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
  const craft: CraftIosConfig = {
    appName: config.appName,
    bundleId: config.bundleId,
    version: config.version,
    buildNumber: config.buildNumber,
    darkMode: config.darkMode,
    backgroundColor: config.backgroundColor,
    iosVersion: config.deploymentTarget,
    teamId: config.teamId,
    devServerURL: normalizeMobileUrl(config.url),
    urlSchemes: config.urlSchemes,
    orientations: config.orientations,
  }

  for (const [key, nativeKey] of Object.entries(CAPABILITY_KEYS)) {
    const enabled = config.capabilities?.[key as keyof typeof CAPABILITY_KEYS]
    if (enabled !== undefined) craft[nativeKey] = enabled
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
}
