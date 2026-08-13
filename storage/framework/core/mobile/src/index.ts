import {
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
} from 'craft-native'

export {
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
}

export type {
  AppState,
  BiometricType,
  CameraOptions,
  DeviceCapabilities,
  DeviceInfo,
  HapticNotificationType,
  HapticStyle,
  Location,
  LocationOptions,
  NotificationOptions,
  PermissionStatus,
  PermissionType,
  PhotoResult,
  ShareOptions,
} from 'craft-native'

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
