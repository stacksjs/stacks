/**
 * Craft's mobile runtime is BUNDLED into this package's `dist`, not resolved
 * from the consumer at runtime.
 *
 * `craft-native/mobile` is the browser-safe half of the SDK: it talks to the
 * `globalThis.craft` bridge when the page runs inside a native WebView, and
 * falls back to web equivalents (or no-ops) everywhere else. Because it is
 * pure browser code, inlining it here is what makes `@stacksjs/mobile` import
 * cleanly from an STX client bundle, a plain web build, and a server render
 * alike — with no optional peer to install and nothing left to resolve.
 *
 * The previous shape lazily `require`d the peer on first property access,
 * which meant every application that wanted native surfaces in the browser had
 * to vendor a pre-bundled copy of this file into its own repository.
 */
import * as craftMobile from 'craft-native/mobile'

import type {
  AppReviewApi,
  BiometricsApi,
  CameraApi,
  CraftMobileBridge,
  CraftReadyEvent,
  DeepLinksApi,
  DeviceApi,
  HapticsApi,
  HealthApi,
  KeepAwakeApi,
  LifecycleApi,
  LiveActivitiesApi,
  LocationApi,
  MobileApi,
  NetworkApi,
  NotificationsApi,
  PermissionsApi,
  PushNotificationsApi,
  SecureStorageApi,
  ShareApi,
  WatchConnectivityApi,
} from './types'

export * from './types'

const {
  biometrics: craftBiometrics,
  camera: craftCamera,
  device: craftDevice,
  haptics: craftHaptics,
  lifecycle: craftLifecycle,
  location: craftLocation,
  notifications: craftNotifications,
  permissions: craftPermissions,
  secureStorage: craftSecureStorage,
  share: craftShare,
  appReview: craftAppReview,
  deepLinks: craftDeepLinks,
  keepAwake: craftKeepAwake,
  network: craftNetwork,
  pushNotifications: craftPushNotifications,
  health: craftHealth,
  liveActivities: craftLiveActivities,
  watchConnectivity: craftWatchConnectivity,
} = craftMobile

export const biometrics: BiometricsApi = craftBiometrics
export const camera: CameraApi = craftCamera
export const device: DeviceApi = craftDevice
export const haptics: HapticsApi = craftHaptics
export const lifecycle: LifecycleApi = craftLifecycle
export const location: LocationApi = craftLocation
export const notifications: NotificationsApi = craftNotifications
export const permissions: PermissionsApi = craftPermissions
export const secureStorage: SecureStorageApi = craftSecureStorage
export const share: ShareApi = craftShare
export const appReview: AppReviewApi = craftAppReview
export function normalizeDeepLinkURL(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null
  if (!value || typeof value !== 'object') return null
  const url = (value as { url?: unknown }).url
  return typeof url === 'string' && url.trim() ? url : null
}

export const deepLinks: DeepLinksApi = {
  async getInitialURL() {
    return normalizeDeepLinkURL(await craftDeepLinks.getInitialURL?.())
  },
  onLink(callback) {
    return craftDeepLinks.onLink?.((value: unknown) => {
      const url = normalizeDeepLinkURL(value)
      if (url) callback(url)
    }) ?? (() => {})
  },
}
export const keepAwake: KeepAwakeApi = craftKeepAwake
export const network: NetworkApi = craftNetwork
export const pushNotifications: PushNotificationsApi = craftPushNotifications
export const health: HealthApi = craftHealth
export const liveActivities: LiveActivitiesApi = craftLiveActivities
export const watchConnectivity: WatchConnectivityApi = craftWatchConnectivity

interface CraftHost extends EventTarget {
  craft?: unknown
}

function host(): CraftHost | undefined {
  if (typeof window === 'undefined') return undefined
  return window as unknown as CraftHost
}

/** Reads the current host, including a bridge injected after this module loaded. */
export function getNativeMobileBridge(): CraftMobileBridge | null {
  const bridge = host()?.craft
  if (!bridge || typeof bridge !== 'object') return null
  if (!('platform' in bridge) || (bridge.platform !== 'ios' && bridge.platform !== 'android'))
    return null

  // Older hosts can omit flags. Missing is unknown, never implicitly enabled.
  const flags = 'capabilities' in bridge ? bridge.capabilities : undefined
  const capabilities = flags && typeof flags === 'object' && !Array.isArray(flags)
    ? Object.fromEntries(Object.entries(flags).filter(([, value]) => typeof value === 'boolean'))
    : {}
  return { platform: bridge.platform, capabilities }
}

export function isNativeMobile(): boolean {
  return getNativeMobileBridge() !== null
}

export function onMobileReady(callback: (event: CraftReadyEvent) => void): () => void {
  const current = host()
  if (!current) return () => {}

  if (getNativeMobileBridge()) {
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) callback(new Event('craftReady') as CraftReadyEvent)
    })
    return () => { cancelled = true }
  }

  const listener: EventListener = (event) => {
    if (!getNativeMobileBridge()) return
    current.removeEventListener('craftReady', listener)
    callback(event as CraftReadyEvent)
  }
  current.addEventListener('craftReady', listener)
  return () => current.removeEventListener('craftReady', listener)
}

export async function withNativeFeedback<T>(action: () => T | Promise<T>): Promise<T> {
  await haptics.impact('light')
  try {
    const result = await action()
    await haptics.notification('success')
    return result
  }
  catch (error) {
    await haptics.notification('error')
    throw error
  }
}

export const mobile: MobileApi = {
  get nativeBridge() { return getNativeMobileBridge() },
  biometrics,
  camera,
  device,
  haptics,
  lifecycle,
  location,
  notifications,
  permissions,
  secureStorage,
  share,
  appReview,
  deepLinks,
  keepAwake,
  network,
  pushNotifications,
  health,
  liveActivities,
  watchConnectivity,
  isNativeMobile,
  onReady: onMobileReady,
  withFeedback: withNativeFeedback,
}
