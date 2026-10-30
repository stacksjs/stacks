/** Enabled native features, not the hardware report from device.getCapabilities(). */
export interface CraftMobileCapabilities {
  haptics?: boolean
  speechRecognition?: boolean
  share?: boolean
  camera?: boolean
  biometric?: boolean
  pushNotifications?: boolean
  secureStorage?: boolean
  storageCompareAndSet?: boolean
  storageSetIfAbsent?: boolean
  crypto?: boolean
  geolocation?: boolean
  backgroundLocation?: boolean
  locationRecordingOwnership?: boolean
  locationRecordingIntentIdentity?: boolean
  heartRateRecordingIntentIdentity?: boolean
  heartRateRecordingOwnership?: boolean
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
  /** The Music app's song and transport (`music`), iOS with `capabilities.appleMusic`. */
  music?: boolean
  /** Workouts scheduled onto the paired Apple Watch (`scheduledWorkouts`), iOS with `capabilities.scheduledWorkouts`. */
  scheduledWorkouts?: boolean
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
  storage: StorageApi
  crypto: CryptoApi
  share: ShareApi
  appReview: AppReviewApi
  deepLinks: DeepLinksApi
  keepAwake: KeepAwakeApi
  brightness: BrightnessApi
  music: MusicApi
  heartRate: HeartRateApi
  scheduledWorkouts: import('./scheduled-workouts').ScheduledWorkoutsApi
  speech: SpeechApi
  network: NetworkApi
  pushNotifications: PushNotificationsApi
  health: HealthApi
  liveActivities: LiveActivitiesApi
  watchConnectivity: WatchConnectivityApi
  dialog: import('./native').DialogApi
  contextMenu: import('./native').ContextMenuApi
  browser: import('./native').BrowserApi
  symbols: import('./native').SymbolsApi
  statusBar: import('./native').StatusBarApi
  chrome: import('./native').ChromeApi
  refresh: import('./native').RefreshApi
  background: import('./native').BackgroundApi
  clipboard: import('./native').ClipboardApi
  db: import('./native').DatabaseApi
  files: import('./native').FilesApi
  shortcuts: import('./native').ShortcutsApi
  widgets: import('./native').WidgetsApi
  orientation: import('./native').OrientationApi
  auth: import('./native').AuthApi
  storeKit: import('./native').StoreKitApi
  isNativeMobile: () => boolean
  whenNative: (timeoutMs?: number) => Promise<boolean>
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

/**
 * The kind of biometric the device offers. Craft reports `'none'` as well
 * since craft-native 0.0.119, so the type admits it.
 */
export type BiometricType = 'faceId' | 'touchId' | 'fingerprint' | 'face' | 'iris' | 'none'

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

/** An identity already registered durably by the caller before native start. */
export interface RecordingStartOptions {
  recordingId?: string
}

export interface LocationRecordingOptions extends LocationOptions, RecordingStartOptions {}

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

export type HapticKind = 'impact' | 'notification' | 'selection'

export interface HapticsApi {
  impact: (style?: HapticStyle) => Promise<void>
  notification: (type?: HapticNotificationType) => Promise<void>
  selection: () => Promise<void>
  vibrate: (pattern: number[]) => Promise<void>
  /** Wakes the Taptic Engine for a tap about to come. A no-op where there is none. */
  prepare: (kind?: HapticKind) => Promise<void>
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

/** Native durable storage. CAS changes an existing value only; false never creates it. */
export interface StorageApi {
  supportsCompareAndSet: () => boolean
  supportsSetIfAbsent: () => boolean
  get: <T = unknown>(key: string) => Promise<T | null>
  set: (key: string, value: unknown) => Promise<boolean>
  remove: (key: string) => Promise<boolean>
  clear: () => Promise<boolean>
  keys: () => Promise<string[]>
  /** Durably creates a new key only. An existing JSON null also returns false. */
  setIfAbsent: (key: string, value: unknown) => Promise<boolean>
  /** Objects compare without key order; arrays keep order and booleans differ from numbers. */
  compareAndSet: (key: string, expectedValue: unknown, nextValue: unknown) => Promise<boolean>
}

/** Secure system UUID generation also works in native asynchronous JS hosts. */
export interface CryptoApi {
  randomUUID: () => Promise<string>
}

export interface SecureStorageApi {
  set: (key: string, value: string) => Promise<void>
  get: (key: string) => Promise<string | null>
  delete: (key: string) => Promise<void>
  clear: () => Promise<void>
}

/** Native checks this ID before reading or changing a recording. */
export interface RecordingOwnershipOptions {
  expectedId: string
}

/**
 * Reading a route recording back. `since` (epoch ms) asks only for the fixes
 * recorded after it: a host that knows it answers with the tail, one that
 * does not answers with every fix, and the caller skips what it has.
 */
export interface LocationRecordingReadOptions extends RecordingOwnershipOptions {
  since?: number
}

export interface LocationApi {
  /** Whether this host checks recording IDs atomically before reads and mutations. */
  supportsRecordingOwnership: () => boolean
  supportsRecordingIntentIdentity: () => boolean
  /** Release a completed owned native copy only after the caller's durable checkpoint. */
  acknowledgeRecording: (options: RecordingOwnershipOptions) => Promise<boolean>
  getCurrentPosition: (options?: LocationOptions) => Promise<Location>
  watchPosition: (callback: (location: Location) => void, options?: LocationOptions) => number
  clearWatch: (watchId: number) => void
  startRecording: (options?: LocationRecordingOptions) => Promise<LocationRecordingState>
  pauseRecording: (options?: RecordingOwnershipOptions) => Promise<LocationRecordingState>
  resumeRecording: (options?: RecordingOwnershipOptions) => Promise<LocationRecordingState>
  stopRecording: (options?: RecordingOwnershipOptions) => Promise<LocationRecordingResult>
  getRecordingState: (options?: RecordingOwnershipOptions) => Promise<LocationRecordingState>
  readRecording: (options?: LocationRecordingReadOptions) => Promise<Location[]>
}

export interface ShareApi {
  /** Resolves `true` when the person shared and `false` when they dismissed the dialog. */
  share: (options: ShareOptions) => Promise<boolean>
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

export interface BrightnessApi {
  isAvailable: () => boolean
  /** The screen's brightness, 0 to 1, or null where there is none to read. */
  get: () => Promise<number | null>
  /** Set it, 0 to 1 (clamped); resolves with what the screen reports, or null off a phone. */
  set: (level: number) => Promise<number | null>
  /** Put the person's own brightness back. Safe to call when nothing was set. */
  restore: () => Promise<void>
}

export interface SpeechOptions {
  /** 0.5 to 2; 1 is a normal speaking rate. */
  rate?: number
  /** A BCP-47 language tag; the device's language when left out. */
  language?: string
  /** Stop whatever is being said first. Defaults to true. */
  interrupt?: boolean
  /** 0.5 to 2; 1 is the voice's own pitch, lower sounds calmer. */
  pitch?: number
  /** Seconds of quiet before the words (up to 5), after whatever was said before them. */
  preDelay?: number
}

export interface SpeechApi {
  /** Whether anything can speak here: the app's voice or the browser's. */
  isAvailable: () => boolean
  /** Speaks, and settles when it ends: true when spoken, false when stopped. */
  speak: (text: string, options?: SpeechOptions) => Promise<boolean>
  stop: () => Promise<void>
}

/** Whether the person has let the app see their music. `unavailable` off a phone. */
export type MusicAuthorization = 'authorized' | 'denied' | 'restricted' | 'notDetermined' | 'unavailable'

export type MusicPlaybackState = 'stopped' | 'playing' | 'paused' | 'interrupted' | 'seekingForward' | 'seekingBackward' | 'unknown'

/**
 * What the Music app is playing. The song fields are null without access,
 * with nothing queued, and while another app (Spotify, a podcast) plays; then
 * `otherAudioPlaying` is true.
 */
export interface NowPlaying {
  /** False where there is no Music app to ask: a browser, Android, an app built without `capabilities.appleMusic`. */
  available: boolean
  authorization: MusicAuthorization
  /** `appleMusic`, or `simulated` for the simulator's stand-in; null without access. */
  source: 'appleMusic' | 'simulated' | null
  playbackState: MusicPlaybackState
  isPlaying: boolean
  itemId: string | null
  title: string | null
  artist: string | null
  album: string | null
  /** Seconds. */
  duration: number | null
  /** Seconds into the song at `timestamp`. */
  position: number | null
  /** A small square JPEG (120 px) as a data URL, when the song has artwork. */
  artworkDataURL: string | null
  /** Some app is playing audio, Apple Music included: read it beside `isPlaying`. */
  otherAudioPlaying: boolean
  /** When the snapshot was taken, in ms since the epoch. */
  timestamp: number
}

export interface MusicSkipOptions {
  /** Past this many seconds into a song, restart it instead (the Music app's 3 by default); 0 always goes back. */
  restartAfter?: number
}

export type MusicMethod = 'getAuthorizationStatus' | 'requestAuthorization' | 'getNowPlaying' | 'play' | 'pause' | 'togglePlayPause' | 'skipToNext' | 'skipToPrevious' | 'observe'

/** Whether the person has let the app use Bluetooth. `unavailable` off a phone. */
export type HeartRateAuthorization = 'authorized' | 'denied' | 'restricted' | 'notDetermined' | 'unavailable'

/** The phone's Bluetooth radio; `unknown` until something has asked for it. */
export type BluetoothState = 'poweredOn' | 'poweredOff' | 'unauthorized' | 'unsupported' | 'resetting' | 'unknown'

/** A strap that drops out is asked for again (`reconnecting`) until `disconnect()`. */
export type HeartRateConnection = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

/** A heart-rate strap, or a watch broadcasting its heart rate. */
export interface HeartRateDevice {
  /** The phone's own id for it: what `connect` takes. */
  id: string
  name: string
  /** Signal strength, dBm, from the scan; 0 for a strap already connected to the phone. */
  rssi: number | null
}

export interface HeartRateRecordingState {
  id: string | null
  active: boolean
  paused: boolean
  /** ms since the epoch. */
  startedAt: number | null
  sampleCount: number | null
}

export interface HeartRateState {
  /** False off a phone, in an app built without `capabilities.heartRate`, or on a phone without Bluetooth. */
  available: boolean
  bluetooth: BluetoothState
  authorization: HeartRateAuthorization
  scanning: boolean
  connection: HeartRateConnection
  /** The strap connected, or being connected to. */
  device: HeartRateDevice | null
  /** The strap `reconnect()` asks for: the last one connected on this phone. */
  lastDevice: HeartRateDevice | null
  /** The latest reading while it is fresh (ten seconds), else null. */
  bpm: number | null
  lastReadingAt: number | null
  recording: HeartRateRecordingState
}

export interface HeartRateReading {
  bpm: number
  /** Milliseconds between beats, oldest first; empty when the strap sends none. */
  rrIntervals: number[]
  /** Whether the strap touches skin; null when it cannot tell. */
  contact: boolean | null
  energyExpended: number | null
  /** ms since the epoch. */
  timestamp: number
  deviceId: string | null
}

/** A reading as a recording keeps it. */
export interface HeartRateSample {
  /** ms since the epoch. */
  timestamp: number
  bpm: number
  /** Milliseconds between beats, when the strap sent them. */
  rr?: number[]
}

export type HeartRateMethod = 'getState' | 'requestAuthorization' | 'scan' | 'stopScan' | 'getDevices' | 'connect' | 'reconnect' | 'disconnect'
  | 'startRecording' | 'pauseRecording' | 'resumeRecording' | 'stopRecording' | 'getRecordingState' | 'readRecording' | 'acknowledgeRecording'

/** The recording half of HeartRateApi: what a route recorder drives. */
export interface HeartRateRecordingApi {
  isAvailable: () => boolean
  supportsRecordingOwnership: () => boolean
  supportsRecordingIntentIdentity: () => boolean
  acknowledgeRecording: (options: RecordingOwnershipOptions) => Promise<boolean>
  startRecording: (options?: RecordingStartOptions) => Promise<HeartRateRecordingState>
  pauseRecording: (options?: RecordingOwnershipOptions) => Promise<HeartRateRecordingState>
  resumeRecording: (options?: RecordingOwnershipOptions) => Promise<HeartRateRecordingState>
  stopRecording: (options?: RecordingOwnershipOptions) => Promise<HeartRateRecordingState & { samples: HeartRateSample[] }>
  getRecordingState: (options?: RecordingOwnershipOptions) => Promise<HeartRateRecordingState>
  readRecording: (options?: { since?: number, expectedId?: string }) => Promise<HeartRateSample[]>
}

export interface HeartRateApi extends HeartRateRecordingApi {
  /** Whether this app can read a heart-rate strap (false until the bridge has arrived). */
  isAvailable: () => boolean
  /** Whether this app build answers `method`; an older build may lack one. */
  supports: (method: HeartRateMethod) => boolean
  /** Bluetooth, the connection, the strap and its latest reading, without asking anything. */
  getState: () => Promise<HeartRateState>
  /** iOS's Bluetooth prompt the first time, its remembered answer after. Call it from a tap. */
  requestAuthorization: () => Promise<HeartRateAuthorization>
  /** Look for straps for `timeout` seconds (15); `onDevice` hears each one. Can ask for Bluetooth. */
  scan: (options?: { timeout?: number }) => Promise<HeartRateState>
  stopScan: () => Promise<HeartRateState>
  /** What the last scan found, strongest signal first. */
  getDevices: () => Promise<HeartRateDevice[]>
  /**
   * Connect and subscribe to its readings; the strap is remembered. Rejects
   * with code TIMEOUT after 15 s while still asking for it (a strap wakes when
   * worn), BLUETOOTH_OFF, NOT_AUTHORIZED or NOT_FOUND.
   */
  connect: (id: string) => Promise<HeartRateState>
  /** Ask for the remembered strap again without waiting for it; no-op without one. */
  reconnect: () => Promise<HeartRateState>
  /** Stop asking for the strap; `forget` also drops it from memory. */
  disconnect: (options?: { forget?: boolean }) => Promise<HeartRateState>
  /** Each reading, about once a second; never fires off a phone. */
  onReading: (callback: (reading: HeartRateReading) => void) => () => void
  /** Each strap a scan finds. */
  onDevice: (callback: (device: HeartRateDevice) => void) => () => void
  /** Bluetooth, scanning or the connection changed. */
  onState: (callback: (state: HeartRateState) => void) => () => void
}

export interface MusicApi {
  /** Whether this app can show and steer the Music app (false until the bridge has arrived). */
  isAvailable: () => boolean
  /** Whether this app build answers `method`; an older build may lack one. */
  supports: (method: MusicMethod) => boolean
  /** Where access stands, without asking. */
  getAuthorizationStatus: () => Promise<MusicAuthorization>
  /** iOS's media library prompt the first time, its remembered answer after. Call it from a tap. */
  requestAuthorization: () => Promise<MusicAuthorization>
  /** The song, its artwork and the playback state; `{ available: false }` off a phone. */
  getNowPlaying: () => Promise<NowPlaying>
  play: () => Promise<NowPlaying>
  pause: () => Promise<NowPlaying>
  togglePlayPause: () => Promise<NowPlaying>
  skipToNext: () => Promise<NowPlaying>
  /** Like the Music app's own button: a few seconds in, it restarts the song. */
  skipToPrevious: (options?: MusicSkipOptions) => Promise<NowPlaying>
  /** Every change of song or playback state, pushed by native; never fires off a phone. */
  onChange: (callback: (nowPlaying: NowPlaying) => void) => () => void
}

export interface DeepLinksApi {
  getInitialURL: () => Promise<string | null>
  /** `link.initial` marks the link the app was launched with, which getInitialURL also answers. */
  onLink: (callback: (url: string, link?: { initial: boolean }) => void) => () => void
}

/**
 * What the app's native screens draw before the page has loaded: JSON the
 * page keeps under a name, which a native screen reads synchronously
 * (`craft.snapshots.get(name)`) for its first frame. Outside an app with
 * native screens, nothing is kept and every call answers false.
 */
export interface SnapshotsApi {
  isAvailable: () => boolean
  /** Keep `value` (anything JSON can hold) as `name`: letters, digits, `.`, `_` and `-`. */
  set: (name: string, value: unknown) => boolean
  remove: (name: string) => boolean
  /** Forget every snapshot, as on signing out. */
  clear: () => boolean
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

export type HealthDataType =
  | 'steps'
  | 'heartRate'
  | 'activeEnergy'
  | 'distance'
  | 'workouts'
  | 'restingHeartRate'
  | 'heartRateVariability'
  | 'bodyMass'
  | 'sleep'
  /** Food logged by any app, per day: kcal eaten, then grams of protein, carbohydrate and fat. Read only (Craft 0.0.160). */
  | 'dietaryEnergy'
  | 'dietaryProtein'
  | 'dietaryCarbohydrates'
  | 'dietaryFat'
  /** Mindful minutes (meditation, breathing): `saveMindfulSession` writes, `getMindfulSessions` reads (Craft 0.0.161). */
  | 'mindful'
  /** Blood glucose from a CGM or meter, in mg/dL: read with `getSamples`. Read only (Craft 0.0.291). */
  | 'bloodGlucose'
  /** Insulin from a pump, pen or loop, in IU, marked basal or bolus: read with `getSamples`. Read only; HealthKit only (Craft 0.0.291). */
  | 'insulinDelivery'

/** The types with one value per day. `sleep` is hours asleep, counted on the day you woke. */
export type HealthDailyType = Exclude<HealthDataType, 'workouts' | 'mindful' | 'bloodGlucose' | 'insulinDelivery'>

/** What `health.getSamples()` reads one sample at a time: glucose, insulin and carbs. */
export type HealthSampleType = 'bloodGlucose' | 'insulinDelivery' | 'dietaryCarbohydrates'

/** One glucose reading, insulin dose or carb entry as the writing app saved it. */
export interface HealthQuantitySample {
  /** HealthKit's UUID or Health Connect's record id: stable across reads. */
  id: string
  /** In `unit`: mg/dL for glucose, IU for insulin, g for carbs. */
  value: number
  unit: 'mg/dL' | 'IU' | 'g'
  /** Epoch ms. */
  startDate: number
  /** Epoch ms; a basal delivery spans its segment. */
  endDate: number
  sourceName: string
  sourceBundleId: string
  /** True when this app wrote it. */
  ownApp: boolean
  deviceName?: string
  /** Insulin only: what the dose was for. */
  insulinReason?: 'basal' | 'bolus'
  /** Glucose only: when it was taken relative to a meal, when the source said. */
  mealTime?: 'beforeMeal' | 'afterMeal' | 'fasting' | 'general'
  /** Glucose only (Health Connect): what was sampled, when the source said. */
  specimen?: string
}

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

export interface HealthWorkoutQuery {
  /** Epoch milliseconds. Defaults to 30 days ago. */
  startDate?: number
  /** Epoch milliseconds. Defaults to now. */
  endDate?: number
  /** At most this many, newest first. Defaults to 200, capped at 1000. */
  limit?: number
}

/** The activity of a workout read from Apple Health, named independently of the SDK. */
export type HealthWorkoutActivity =
  | 'running' | 'cycling' | 'walking' | 'hiking' | 'swimming' | 'rowing' | 'elliptical'
  | 'stairClimbing' | 'yoga' | 'pilates' | 'strength' | 'hiit' | 'crossTraining'
  | 'crossCountrySkiing' | 'skiing' | 'paddling' | 'climbing' | 'dance' | 'mobility' | 'other'

/** A workout recorded by the watch, or by any app that writes to Apple Health. */
export interface HealthWorkoutSample {
  /** HealthKit's UUID: stable across reads, so it can key an import. */
  id: string
  type: HealthWorkoutActivity
  startDate: number
  endDate: number
  durationSeconds: number
  sourceName: string
  indoor: boolean
  distanceMeters?: number
  elevationGainMeters?: number
  activeEnergyCalories?: number
  averageHeartRate?: number
  maxHeartRate?: number
}

export interface HealthDailyValue {
  /** The local day, YYYY-MM-DD. */
  date: string
  value: number
  unit: string
}

export interface HealthSampleQuery {
  /** Epoch milliseconds. Defaults to a day before `endDate`. */
  startDate?: number
  /** Epoch milliseconds. Defaults to now. */
  endDate?: number
}

export interface HealthHeartRateQuery extends HealthSampleQuery {
  /** At most this many, oldest first. Defaults to 10000, capped at 50000. */
  limit?: number
}

/** One heart-rate reading from Apple Health, in beats per minute. */
export interface HealthHeartRateSample {
  bpm: number
  /** Epoch milliseconds. */
  startDate: number
  /** Epoch milliseconds; the same as `startDate` for a single reading. */
  endDate: number
  /** The app that wrote it, e.g. the watch's own name. */
  sourceName: string
  /** The device that measured it, when the source says ("Apple Watch"). */
  deviceName?: string
  deviceModel?: string
  /** A series of readings (a watch workout) also carries its count, lowest and highest. */
  count?: number
  min?: number
  max?: number
  /** What the wearer was doing, when the watch says. */
  motionContext?: 'sedentary' | 'active'
}

/** A sleep analysis stage: in bed, awake, or asleep (staged or not). */
export type HealthSleepStage = 'inBed' | 'awake' | 'asleep' | 'core' | 'deep' | 'rem'

/** One stretch of a night as a source recorded it. */
export interface HealthSleepInterval {
  /** Epoch milliseconds. */
  startDate: number
  /** Epoch milliseconds. */
  endDate: number
  stage: HealthSleepStage
  /** Every asleep stage; false for time in bed and time awake. */
  asleep: boolean
  sourceName: string
  deviceName?: string
}

/** A meditation or breathing session to record as mindful minutes. */
export interface HealthMindfulSession {
  /**
   * The app's own id for the session (up to 128 characters), kept as the
   * sample's external UUID: saving the same id again keeps the first sample.
   */
  id: string
  /** Epoch milliseconds. */
  startDate: number
  /** Epoch milliseconds, after `startDate` and at most a day later. */
  endDate: number
}

export interface HealthMindfulSessionResult {
  /** HealthKit's UUID for the sample. */
  id: string
  /** The id it was saved with. */
  externalId: string
  /** True when this id had been saved before and that sample was kept. */
  existing: boolean
}

export interface HealthMindfulSessionQuery extends HealthSampleQuery {
  /** At most this many, oldest first. Defaults to 1000, capped at 5000. */
  limit?: number
}

/** A mindful session in Apple Health, written by any app (the Mindfulness app, Calm, this one). */
export interface HealthMindfulSample {
  /** HealthKit's UUID. */
  id: string
  /** Epoch milliseconds. */
  startDate: number
  /** Epoch milliseconds. */
  endDate: number
  durationSeconds: number
  sourceName: string
  sourceBundleId: string
  /** True when this app wrote it: skip these when importing, they are your own. */
  ownApp: boolean
  /** The id the writing app saved it with, when it gave one. */
  externalId?: string
  deviceName?: string
}

/** The health reads and writes an installed app build may or may not answer. */
export type HealthReadMethod = 'getWorkouts' | 'getDailyStatistics' | 'getHeartRateSamples' | 'getSamples' | 'getSleepIntervals' | 'saveMindfulSession' | 'getMindfulSessions'
  | 'startHeartRateUpdates' | 'stopHeartRateUpdates'

export interface HealthHeartRateUpdatesOptions {
  /** Epoch ms: readings from here on. Defaults to two minutes ago. */
  since?: number
}

export interface HealthAuthorizationOptions {
  /** `false` asks to read only, for an app that never writes back. */
  write?: boolean
}

export interface HealthApi {
  requestAuthorization: (types: HealthDataType[], options?: HealthAuthorizationOptions) => Promise<boolean>
  getData: (type: HealthDataType, options?: HealthDataOptions) => Promise<HealthDataResult>
  saveWorkout: (workout: HealthWorkout) => Promise<HealthWorkoutResult>
  /** Workouts in Apple Health, newest first. iOS only for now. */
  getWorkouts: (options?: HealthWorkoutQuery) => Promise<HealthWorkoutSample[]>
  /** One value per local day between two dates. iOS only for now. */
  getDailyStatistics: (type: HealthDailyType, options?: HealthDataOptions) => Promise<HealthDailyValue[]>
  /**
   * Every heart-rate reading between two instants, oldest first: bpm, start
   * and end, and the app and device that took it. iOS only for now; resolves
   * `[]` in a browser or an app build that predates it (see `supports`).
   */
  getHeartRateSamples: (options?: HealthHeartRateQuery) => Promise<HealthHeartRateSample[]>
  /**
   * Every glucose reading, insulin dose or carb entry between two instants,
   * oldest first, each with its own id so a sync stores it once. Needs the
   * type's read grant. Health Connect has no insulin, so Android answers `[]`
   * for `insulinDelivery`; so does a browser or an app build that predates it
   * (see `supports`).
   */
  getSamples: (type: HealthSampleType, options?: HealthHeartRateQuery) => Promise<HealthQuantitySample[]>
  /**
   * Sleep between two instants, oldest first: time in bed, and each asleep or
   * awake stretch with its stage. iOS only for now; resolves `[]` in a browser
   * or an app build that predates it (see `supports`).
   */
  getSleepIntervals: (options?: HealthSampleQuery) => Promise<HealthSleepInterval[]>
  /**
   * Record a meditation or breathing session as mindful minutes (the
   * `mindful` grant, with writing allowed). Saving the same `id` twice keeps
   * the first sample. iOS only for now; resolves `null` in a browser or an app
   * build that predates it (see `supports`), and rejects when HealthKit
   * refuses (writing not allowed).
   */
  saveMindfulSession: (session: HealthMindfulSession) => Promise<HealthMindfulSessionResult | null>
  /**
   * Every app's mindful sessions between two instants, oldest first, each
   * marked `ownApp` when this app wrote it. iOS only for now; resolves `[]` in
   * a browser or an app build that predates it.
   */
  getMindfulSessions: (options?: HealthMindfulSessionQuery) => Promise<HealthMindfulSample[]>
  /**
   * Heart rate as Apple Health receives it (Craft 0.0.166, an
   * HKAnchoredObjectQuery): what is there from `since`, then every batch the
   * watch syncs, each reading once, to `onHeartRate`. A watch syncs every few
   * seconds while it runs a workout or a Mindfulness session, every few
   * minutes otherwise. One stream at a time; starting again replaces it.
   * Needs the `heartRate` grant. Resolves false in a browser or an app build
   * that predates it (see `supports`), and rejects when HealthKit refuses.
   */
  startHeartRateUpdates: (options?: HealthHeartRateUpdatesOptions) => Promise<boolean>
  /** Stops the stream; true also when none ran. */
  stopHeartRateUpdates: () => Promise<boolean>
  /** Each batch of readings the stream delivers, oldest first. Returns the way to stop listening. */
  onHeartRate: (callback: (samples: HealthHeartRateSample[]) => void) => () => void
  /**
   * Whether the running app build answers `method`, right now. An app
   * installed before a read existed has none, so a page checks before offering
   * what needs it. False in a browser and before the bridge has arrived.
   */
  supports: (method: HealthReadMethod) => boolean
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
