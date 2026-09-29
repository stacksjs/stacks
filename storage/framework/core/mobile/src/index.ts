/**
 * Native mobile surfaces for Stacks and STX apps, from `craft-native/mobile`.
 *
 * `craft-native/mobile` is the browser-safe half of the SDK: it talks to the
 * `globalThis.craft` bridge when the page runs inside a native WebView, and
 * falls back to web equivalents (or no-ops) everywhere else, so this package
 * imports cleanly from an STX client bundle, a plain web build, and a server
 * render alike. It is a dependency, which the build leaves external, so the
 * app's bundler resolves it.
 *
 * Each API is imported by name. A bundler keeps what a named import's binding
 * reaches and drops the rest of craft-native's modules; reading the APIs off
 * the module namespace object instead kept every one of them, so importing
 * `secureStorage` alone bundled all of craft-native/mobile, 25.4 KB rather
 * than 1.8 KB (stacksjs/stacks#2670).
 */
import {
  appReview as craftAppReview,
  biometrics as craftBiometrics,
  camera as craftCamera,
  deepLinks as craftDeepLinks,
  device as craftDevice,
  haptics as craftHaptics,
  health as craftHealth,
  keepAwake as craftKeepAwake,
  lifecycle as craftLifecycle,
  liveActivities as craftLiveActivities,
  location as craftLocation,
  network as craftNetwork,
  notifications as craftNotifications,
  permissions as craftPermissions,
  pushNotifications as craftPushNotifications,
  secureStorage as craftSecureStorage,
  share as craftShare,
  watchConnectivity as craftWatchConnectivity,
} from 'craft-native/mobile'

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

export * from './gestures'
export * from './navigation'
export * from './route'
export * from './types'

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
    return craftDeepLinks.onLink?.((value: unknown, link?: { initial?: boolean }) => {
      const url = normalizeDeepLinkURL(value)
      if (url) callback(url, { initial: link?.initial === true })
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

interface CraftTransports {
  craft?: unknown
  CraftAndroid?: unknown
  webkit?: { messageHandlers?: { craft?: unknown } }
}

/**
 * Whether this page runs inside Craft's phone shell, before the bridge exists.
 *
 * Craft installs `window.craft` once the page has finished loading — images
 * and all — so `isNativeMobile()` answers `false` during setup on a phone, and
 * a layout that decides then renders the website's chrome in the app. The
 * transports are there from the start: Android's `CraftAndroid` interface, and
 * on iOS the `craft` message handler. Craft's macOS windows carry that handler
 * too, so on iOS an iPhone or iPad user agent is what makes it the phone app.
 */
export function hasNativeMobileHost(): boolean {
  if (typeof window === 'undefined') return false
  const host = window as unknown as CraftTransports
  if (host.CraftAndroid) return true
  const agent = typeof navigator === 'undefined' ? '' : navigator.userAgent
  return Boolean(host.webkit?.messageHandlers?.craft) && /iPhone|iPad|iPod/.test(agent)
}

/**
 * Resolves `true` inside the phone shell and `false` in a browser, at a moment
 * when the answer is right.
 *
 * A browser answers at once. A phone answers at once too when its host is
 * already recognisable, and otherwise once `craftReady` fires. The timeout is
 * a floor for a host that never fires it: a caller waiting on this has to
 * decide something to render anything.
 */
export function whenNativeMobile(timeoutMs = 2000): Promise<boolean> {
  if (isNativeMobile() || hasNativeMobileHost()) return Promise.resolve(true)
  const current = host()
  const transports = current as unknown as CraftTransports | undefined
  if (!current || !(transports?.craft || transports?.webkit?.messageHandlers?.craft))
    return Promise.resolve(false)

  return new Promise<boolean>((resolve) => {
    const done = (): void => {
      clearTimeout(timer)
      current.removeEventListener('craftReady', done)
      resolve(isNativeMobile())
    }
    const timer = setTimeout(done, timeoutMs)
    current.addEventListener('craftReady', done, { once: true })
  })
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
  whenNative: whenNativeMobile,
  onReady: onMobileReady,
  withFeedback: withNativeFeedback,
}
