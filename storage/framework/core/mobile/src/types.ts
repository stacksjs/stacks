export interface DeviceInfo {
  platform: 'ios' | 'android' | 'macos' | 'windows' | 'linux'
  osVersion: string
  model: string
  manufacturer: string
  deviceId: string
  isTablet: boolean
  screen?: { width: number, height: number, scale: number }
  battery?: { level: number, isCharging: boolean }
  network?: { type: 'wifi' | 'cellular' | 'ethernet' | 'none', isConnected: boolean }
}

export interface DeviceCapabilities {
  camera: boolean
  biometrics: boolean
  nfc: boolean
  bluetooth: boolean
  gps: boolean
  backgroundLocation?: boolean
  accelerometer: boolean
  gyroscope: boolean
  haptics: boolean
  ar: boolean
  faceId: boolean
  touchId: boolean
}

export type HapticStyle = 'light' | 'medium' | 'heavy' | 'soft' | 'rigid'
export type HapticNotificationType = 'success' | 'warning' | 'error'
export type PermissionType =
  | 'camera'
  | 'microphone'
  | 'photos'
  | 'location'
  | 'locationAlways'
  | 'notifications'
  | 'contacts'
  | 'calendar'
  | 'reminders'
  | 'bluetooth'
  | 'motion'
  | 'health'
export type PermissionStatus = 'granted' | 'denied' | 'undetermined' | 'restricted'

export interface CameraOptions {
  camera?: 'front' | 'back'
  quality?: number
  maxWidth?: number
  maxHeight?: number
  saveToGallery?: boolean
}

export interface PhotoResult {
  base64: string
  uri: string
  width: number
  height: number
  mimeType: string
}

export type BiometricType = 'faceId' | 'touchId' | 'fingerprint' | 'face' | 'iris'

export interface Location {
  latitude: number
  longitude: number
  altitude?: number
  accuracy: number
  heading?: number
  speed?: number
  timestamp: number
}

export interface LocationOptions {
  enableHighAccuracy?: boolean
  timeout?: number
  maximumAge?: number
}

export interface LocationRecordingState {
  id: string | null
  active: boolean
  paused: boolean
  startedAt: number | null
  sampleCount?: number
}

export interface LocationRecordingResult extends LocationRecordingState {
  locations: Location[]
}

export interface ShareOptions {
  text?: string
  url?: string
  title?: string
  files?: string[]
}

export type AppState = 'active' | 'inactive' | 'background'

export interface NotificationOptions {
  title: string
  body?: string
  badge?: number
  sound?: string
  data?: Record<string, unknown>
  scheduleAt?: number
}

export interface DeviceApi {
  getInfo: () => Promise<DeviceInfo>
  getCapabilities: () => Promise<DeviceCapabilities>
  isMobile: () => boolean
  isIOS: () => boolean
  isAndroid: () => boolean
  getLocale: () => string
  getTimezone: () => string
}

export interface HapticsApi {
  impact: (style?: HapticStyle) => Promise<void>
  notification: (type?: HapticNotificationType) => Promise<void>
  selection: () => Promise<void>
  vibrate: (pattern: number[]) => Promise<void>
}

export interface PermissionsApi {
  check: (permission: PermissionType) => Promise<PermissionStatus>
  request: (permission: PermissionType) => Promise<PermissionStatus>
  checkMultiple: (permissions: PermissionType[]) => Promise<Record<PermissionType, PermissionStatus>>
  requestMultiple: (permissions: PermissionType[]) => Promise<Record<PermissionType, PermissionStatus>>
  openSettings: () => Promise<void>
}

export interface CameraApi {
  takePicture: (options?: CameraOptions) => Promise<PhotoResult>
  pickImage: () => Promise<PhotoResult>
  pickMultiple: (options?: { maxCount?: number }) => Promise<PhotoResult[]>
  isAvailable: () => Promise<boolean>
}

export interface BiometricsApi {
  isAvailable: () => Promise<boolean>
  getBiometricType: () => Promise<BiometricType | null>
  authenticate: (reason: string) => Promise<boolean>
}

export interface SecureStorageApi {
  set: (key: string, value: string) => Promise<void>
  get: (key: string) => Promise<string | null>
  delete: (key: string) => Promise<void>
  clear: () => Promise<void>
}

export interface LocationApi {
  getCurrentPosition: (options?: LocationOptions) => Promise<Location>
  watchPosition: (callback: (location: Location) => void, options?: LocationOptions) => number
  clearWatch: (watchId: number) => void
  startRecording: (options?: LocationOptions) => Promise<LocationRecordingState>
  pauseRecording: () => Promise<LocationRecordingState>
  resumeRecording: () => Promise<LocationRecordingState>
  stopRecording: () => Promise<LocationRecordingResult>
  getRecordingState: () => Promise<LocationRecordingState>
  readRecording: () => Promise<Location[]>
}

export interface ShareApi {
  share: (options: ShareOptions) => Promise<void>
  isAvailable: () => boolean
}

export interface LifecycleApi {
  getState: () => AppState
  onStateChange: (callback: (state: AppState) => void) => () => void
}

export interface NotificationsApi {
  show: (options: NotificationOptions) => Promise<void>
  schedule: (options: NotificationOptions) => Promise<void>
  cancelAll: () => Promise<void>
  setBadge: (count: number) => Promise<void>
}

export interface KeepAwakeApi {
  enable: () => Promise<void>
  disable: () => Promise<void>
}

export interface DeepLinksApi {
  getInitialURL: () => Promise<string | null>
  onLink: (callback: (url: string) => void) => () => void
}

export interface NetworkStatus {
  type: 'wifi' | 'cellular' | 'ethernet' | 'none' | 'unknown'
  isConnected: boolean
}

export interface NetworkApi {
  getStatus: () => Promise<NetworkStatus>
  onChange: (callback: (status: NetworkStatus) => void) => () => void
}

export interface AppReviewApi {
  request: () => Promise<boolean>
}

export interface PushNotificationsApi {
  register: () => Promise<string>
  onToken: (callback: (token: string) => void) => () => void
  onNotification: (callback: (data: Record<string, unknown>) => void) => () => void
}
