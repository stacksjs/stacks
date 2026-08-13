// @ts-expect-error craft-native/mobile is on Craft main pending its next package release
import * as craftMobile from 'craft-native/mobile'
import type {
  BiometricsApi,
  CameraApi,
  DeviceApi,
  HapticsApi,
  LifecycleApi,
  LocationApi,
  NotificationsApi,
  PermissionsApi,
  SecureStorageApi,
  ShareApi,
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
  isNativeMobile,
  onReady: onMobileReady,
  withFeedback: withNativeFeedback,
}
