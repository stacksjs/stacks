import type { AndroidMobileConfig } from '@stacksjs/types'
import { normalizeMobileUrl } from './ios-config'

export interface CraftAndroidConfig {
  [key: string]: unknown
  appName: string
  packageName: string
  version?: string
  versionCode?: number
  minSdk?: number
  targetSdk?: number
  darkMode?: boolean
  backgroundColor?: string
  devServerURL?: string
  trustedOrigins?: string[]
  urlSchemes?: string[]
  appIconPath?: string
  googleServicesFile?: string
  enableHealthConnect?: boolean
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
} as const

export function toCraftAndroidConfig(config: AndroidMobileConfig): CraftAndroidConfig {
  const devServerURL = normalizeMobileUrl(config.url)
  const trustedOrigins = new Set(config.trustedOrigins ?? [])
  if (devServerURL) trustedOrigins.add(new URL(devServerURL).origin)
  const craft: CraftAndroidConfig = {
    appName: config.appName,
    packageName: config.packageName,
    version: config.version,
    versionCode: config.versionCode,
    minSdk: config.minSdk,
    targetSdk: config.targetSdk,
    darkMode: config.darkMode,
    backgroundColor: config.backgroundColor,
    devServerURL,
    trustedOrigins: [...trustedOrigins],
    urlSchemes: config.urlSchemes,
    appIconPath: config.appIcon,
    googleServicesFile: config.googleServicesFile,
  }
  for (const [key, nativeKey] of Object.entries(CAPABILITY_KEYS)) {
    const enabled = config.capabilities?.[key as keyof typeof CAPABILITY_KEYS]
    if (enabled !== undefined) craft[nativeKey] = enabled
  }
  if (config.capabilities?.backgroundLocation) craft.enableGeolocation = true
  return craft
}

export function validateAndroidMobileConfig(config: AndroidMobileConfig): void {
  if (!config.appName?.trim()) throw new Error('config/mobile.ts must define android.appName')
  if (!/^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/.test(config.packageName)) {
    throw new Error(`Invalid Android package name: ${config.packageName}`)
  }
  if (config.url && config.webAssets) throw new Error('Choose either android.url or android.webAssets in config/mobile.ts, not both')
  if (!config.url && !config.webAssets) throw new Error('config/mobile.ts must define android.url or android.webAssets')
  if (config.fallbackWebAssets && !config.url) throw new Error('android.fallbackWebAssets requires android.url')
  if (config.url) {
    const normalized = normalizeMobileUrl(config.url)
    const url = new URL(normalized!)
    const isLocal = ['localhost', '127.0.0.1', '10.0.2.2'].includes(url.hostname)
    if (url.protocol !== 'https:' && !isLocal) throw new Error('android.url must use HTTPS outside local development')
  }
  if (config.capabilities?.healthConnect && (config.minSdk ?? 26) < 26) {
    throw new Error('Android Health Connect requires android.minSdk 26 or newer')
  }
  for (const scheme of config.urlSchemes ?? []) {
    if (!/^[a-z][a-z0-9+.-]*$/i.test(scheme)) throw new Error(`Invalid Android URL scheme: ${scheme}`)
  }
}
