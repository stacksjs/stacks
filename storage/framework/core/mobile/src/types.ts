/** Enabled native features, not the hardware report from device.getCapabilities(). */
export interface CraftMobileCapabilities {
  haptics?: boolean
  speechRecognition?: boolean
  share?: boolean
  camera?: boolean
  biometric?: boolean
  pushNotifications?: boolean
  secureStorage?: boolean
  geolocation?: boolean
  backgroundLocation?: boolean
  healthKit?: boolean
  health?: boolean
  liveActivities?: boolean
  watchConnectivity?: boolean
  clipboard?: boolean
  contacts?: boolean
  calendar?: boolean
  localNotifications?: boolean
  inAppPurchase?: boolean
  keepAwake?: boolean
  orientationLock?: boolean
  deepLinks?: boolean
  flashlight?: boolean
  network?: boolean
  deviceInfo?: boolean
  badge?: boolean
  appReview?: boolean
  appBadge?: boolean
  networkStatus?: boolean
  openURL?: boolean
  vibrationPattern?: boolean
  appState?: boolean
  qrScanner?: boolean
  filePicker?: boolean
  fileDownload?: boolean
  googleSignIn?: boolean
  audioRecording?: boolean
  videoRecording?: boolean
  motionSensors?: boolean
  localDatabase?: boolean
  bluetooth?: boolean
  nfc?: boolean
  screenCapture?: boolean
}

/** Browser-safe metadata from Craft's iOS or Android bridge. */
export interface CraftMobileBridge {
  readonly platform: 'ios' | 'android'
  readonly capabilities: Readonly<CraftMobileCapabilities>
}

export interface CraftReadyEvent extends Event {
  detail?: { platform?: string }
}

/** Services retain their web fallbacks; nativeBridge describes only a native host. */
export interface MobileApi {
  readonly nativeBridge: CraftMobileBridge | null
  biometrics: BiometricsApi
  camera: CameraApi
  device: DeviceApi
  haptics: HapticsApi
  lifecycle: LifecycleApi
  location: LocationApi
  notifications: NotificationsApi
  permissions: PermissionsApi
  secureStorage: SecureStorageApi
  share: ShareApi
  appReview: AppReviewApi
  deepLinks: DeepLinksApi
  keepAwake: KeepAwakeApi
  network: NetworkApi
  pushNotifications: PushNotificationsApi
  health: HealthApi
  liveActivities: LiveActivitiesApi
  watchConnectivity: WatchConnectivityApi
  isNativeMobile: () => boolean
  onReady: (callback: (event: CraftReadyEvent) => void) => () => void
  withFeedback: <T>(action: () => T | Promise<T>) => Promise<T>
}

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

export type HealthDataType = 'steps' | 'heartRate' | 'activeEnergy' | 'distance' | 'workouts'

export interface HealthDataOptions {
  startDate?: number
  endDate?: number
}

export interface HealthDataResult {
  value: number
  unit: string
}

export type HealthWorkoutType = 'running' | 'walking' | 'hiking' | 'cycling'

export interface HealthWorkoutLocation {
  latitude: number
  longitude: number
  altitude?: number
  accuracy?: number
  timestamp: number
}

export interface HealthWorkout {
  activityId: string
  type: HealthWorkoutType
  startDate: number
  endDate: number
  distanceMeters?: number
  activeEnergyCalories?: number
  locations?: HealthWorkoutLocation[]
}

export interface HealthWorkoutResult {
  id: string
}

export interface HealthApi {
  requestAuthorization: (types: HealthDataType[]) => Promise<boolean>
  getData: (type: HealthDataType, options?: HealthDataOptions) => Promise<HealthDataResult>
  saveWorkout: (workout: HealthWorkout) => Promise<HealthWorkoutResult>
}

export interface LiveActivityState {
  status?: string
  distanceMeters?: number
  durationSeconds?: number
  progress?: number
}

export interface LiveActivityOptions extends LiveActivityState {
  activityId: string
  title: string
}

export interface LiveActivitiesApi {
  start: (options: LiveActivityOptions) => Promise<{ id: string }>
  update: (state: LiveActivityState) => Promise<void>
  end: () => Promise<void>
}

export interface WatchConnectivityApi {
  send: (message: Record<string, unknown>) => Promise<Record<string, unknown>>
  updateContext: (context: Record<string, unknown>) => Promise<void>
  isReachable: () => Promise<boolean>
  onMessage: (callback: (message: Record<string, unknown>) => void) => () => void
  onReachabilityChange: (callback: (reachable: boolean) => void) => () => void
}
