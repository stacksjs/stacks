/**
 * `craft-native` is an OPTIONAL peer: it only exists in a project that is
 * actually building a mobile app. Importing it at module scope made merely
 * importing this package throw for everyone else — `Cannot find module
 * 'craft-native/mobile'` — including test runs that never touch a native
 * surface, because `@stacksjs/defaults` pulls this package in transitively.
 *
 * Resolved on first use instead. A project without craft-native can import
 * this module, and only a call into a native surface asks for the module that
 * is genuinely missing, with a message that says so.
 */
let craftMobileModule: Record<string, unknown> | undefined

function craftNative(): Record<string, unknown> {
  if (craftMobileModule)
    return craftMobileModule
  try {
    // eslint-disable-next-line ts/no-require-imports
    craftMobileModule = require('craft-native/mobile') as Record<string, unknown>
  }
  catch {
    throw new Error(
      'craft-native is required for the native mobile surfaces. Install it with `bun add craft-native` (>=0.0.65, the first release exporting ./mobile).',
    )
  }
  return craftMobileModule
}

/** Lazily proxy one native namespace, so nothing resolves until it is used. */
function nativeSurface<T extends object>(name: string): T {
  return new Proxy({} as T, {
    get: (_t, prop) => (craftNative()[name] as Record<string | symbol, unknown>)?.[prop],
    has: (_t, prop) => prop in ((craftNative()[name] as object) ?? {}),
  })
}
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


export const biometrics: BiometricsApi = nativeSurface<BiometricsApi>('biometrics')
export const camera: CameraApi = nativeSurface<CameraApi>('camera')
export const device: DeviceApi = nativeSurface<DeviceApi>('device')
export const haptics: HapticsApi = nativeSurface<HapticsApi>('haptics')
export const lifecycle: LifecycleApi = nativeSurface<LifecycleApi>('lifecycle')
export const location: LocationApi = nativeSurface<LocationApi>('location')
export const notifications: NotificationsApi = nativeSurface<NotificationsApi>('notifications')
export const permissions: PermissionsApi = nativeSurface<PermissionsApi>('permissions')
export const secureStorage: SecureStorageApi = nativeSurface<SecureStorageApi>('secureStorage')
export const share: ShareApi = nativeSurface<ShareApi>('share')
export const appReview: AppReviewApi = nativeSurface<AppReviewApi>('appReview')
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
export const keepAwake: KeepAwakeApi = nativeSurface<KeepAwakeApi>('keepAwake')
export const network: NetworkApi = nativeSurface<NetworkApi>('network')
export const pushNotifications: PushNotificationsApi = nativeSurface<PushNotificationsApi>('pushNotifications')
export const health: HealthApi = nativeSurface<HealthApi>('health')
export const liveActivities: LiveActivitiesApi = nativeSurface<LiveActivitiesApi>('liveActivities')
export const watchConnectivity: WatchConnectivityApi = nativeSurface<WatchConnectivityApi>('watchConnectivity')

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
