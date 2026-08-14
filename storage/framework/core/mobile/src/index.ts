import * as craftMobile from 'craft-native/mobile'
import type {
  AppReviewApi,
  BiometricsApi,
  CameraApi,
  DeepLinksApi,
  DeviceApi,
  HapticsApi,
  HealthApi,
  KeepAwakeApi,
  LifecycleApi,
  LiveActivitiesApi,
  LocationApi,
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

interface CraftReadyEvent extends Event {
  detail?: { platform?: string }
}

interface CraftHost extends EventTarget {
  craft?: unknown
}

function host(): CraftHost | undefined {
  if (typeof globalThis === 'undefined') return undefined
  return globalThis as unknown as CraftHost
}

export function isNativeMobile(): boolean {
  const current = host()
  return Boolean(current?.craft) && device.isMobile()
}

export function onMobileReady(callback: (event: CraftReadyEvent) => void): () => void {
  const current = host()
  if (!current) return () => {}

  if (current.craft) {
    queueMicrotask(() => callback(new Event('craftReady') as CraftReadyEvent))
    return () => {}
  }

  const listener: EventListener = event => callback(event as CraftReadyEvent)
  current.addEventListener('craftReady', listener, { once: true })
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

export const mobile = {
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
