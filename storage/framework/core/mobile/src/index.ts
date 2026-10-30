/**
 * Native mobile surfaces for Stacks and STX apps, from `craft-native/mobile`.
 *
 * `craft-native/mobile` exposes the SDK APIs through the available Craft
 * native host bridge, with web equivalents (or no-ops) when no host provides
 * them. The API bridge is independent of the renderer: shared STX components
 * can render native views through Craft or target the web. This package also
 * imports cleanly during server rendering. The SDK is a dependency that the
 * build leaves external for the app's bundler to resolve.
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
  brightness as craftBrightness,
  camera as craftCamera,
  deepLinks as craftDeepLinks,
  device as craftDevice,
  haptics as craftHaptics,
  health as craftHealth,
  heartRate as craftHeartRate,
  keepAwake as craftKeepAwake,
  lifecycle as craftLifecycle,
  liveActivities as craftLiveActivities,
  location as craftLocation,
  music as craftMusic,
  network as craftNetwork,
  notifications as craftNotifications,
  permissions as craftPermissions,
  pushNotifications as craftPushNotifications,
  secureStorage as craftSecureStorage,
  share as craftShare,
  speech as craftSpeech,
  snapshots as craftSnapshots,
  splash as craftSplash,
  watchConnectivity as craftWatchConnectivity,
} from 'craft-native/mobile'

import type { HealthDataType as CraftHealthDataType } from 'craft-native/mobile'
import type { CraftHost } from './bridge'
import { auth, background, browser, chrome, clipboard, contextMenu, db, dialog, files, orientation, refresh, shortcuts, statusBar, storeKit, symbols, widgets } from './native'
import { afterBridge, callNative, craftHost, hasNativeMobileHost, nativeFunctionNow, onCraftEvent, subscribeWhenReady, whenBridgeReady } from './bridge'
import { storage } from './storage'
import { crypto } from './crypto'
import { scheduledWorkouts } from './scheduled-workouts'
import type {
  AppReviewApi,
  BiometricsApi,
  CameraApi,
  CraftMobileBridge,
  CraftReadyEvent,
  DeepLinksApi,
  SnapshotsApi,
  DeviceApi,
  HapticsApi,
  HealthApi,
  HealthHeartRateSample,
  HealthMindfulSample,
  HealthMindfulSessionResult,
  HealthQuantitySample,
  HealthSleepInterval,
  HeartRateApi,
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
  SpeechApi,
  BrightnessApi,
  MusicApi,
  WatchConnectivityApi,
} from './types'

export * from './bridge'
export * from './controls'
export * from './crash-reporting'
export * from './events'
export * from './gestures'
export * from './navigation'
export * from './route'
export * from './scheduled-workouts'
export * from './session-clock'
export * from './indoor'
export * from './native'
export * from './refresh-control'
export * from './sheet-gesture'
export * from './sheets'
export * from './shell'
export * from './spotlight'
export * from './tab-bar'
export * from './types'
export * from './storage'
export * from './crypto'

// Each service's async methods wait for a native host's bridge (afterBridge):
// asked during an older shell's launch, they reached the web fallback, and a
// secure-storage read answered from localStorage.
export const biometrics: BiometricsApi = {
  isAvailable: () => afterBridge(() => craftBiometrics.isAvailable()),
  getBiometricType: () => afterBridge(() => craftBiometrics.getBiometricType()),
  authenticate: reason => afterBridge(() => craftBiometrics.authenticate(reason)),
}
export const camera: CameraApi = {
  takePicture: options => afterBridge(() => craftCamera.takePicture(options)),
  pickImage: () => afterBridge(() => craftCamera.pickImage()),
  pickMultiple: options => afterBridge(() => craftCamera.pickMultiple(options)),
  isAvailable: () => afterBridge(() => craftCamera.isAvailable()),
}
export const device: DeviceApi = {
  getInfo: () => afterBridge(() => craftDevice.getInfo()),
  getCapabilities: () => afterBridge(() => craftDevice.getCapabilities()),
  isMobile: () => craftDevice.isMobile(),
  isIOS: () => craftDevice.isIOS(),
  isAndroid: () => craftDevice.isAndroid(),
  getLocale: () => craftDevice.getLocale(),
  getTimezone: () => craftDevice.getTimezone(),
}
export const lifecycle: LifecycleApi = craftLifecycle

function locationRecordingOwnership(): boolean {
  return getNativeMobileBridge()?.capabilities.locationRecordingOwnership === true && craftLocation.supportsRecordingOwnership?.() === true
}

function heartRateRecordingOwnership(): boolean {
  return getNativeMobileBridge()?.capabilities.heartRateRecordingOwnership === true && craftHeartRate.supportsRecordingOwnership?.() === true
}

function locationRecordingIntentIdentity(): boolean {
  return locationRecordingOwnership() && getNativeMobileBridge()?.capabilities.locationRecordingIntentIdentity === true && craftLocation.supportsRecordingIntentIdentity?.() === true
}

function heartRateRecordingIntentIdentity(): boolean {
  return heartRateRecordingOwnership() && getNativeMobileBridge()?.capabilities.heartRateRecordingIntentIdentity === true && craftHeartRate.supportsRecordingIntentIdentity?.() === true
}

function recordingStartCall<T extends { id: string | null }>(options: { recordingId?: string } | undefined, supported: () => boolean, call: () => Promise<T>): Promise<T> {
  return afterBridge(async () => {
    const planned = options && Object.hasOwn(options, 'recordingId')
    if (planned) {
      if (!supported())
        throw Object.assign(new Error('This host or adapter cannot start a registered recording identity'), { code: 'RECORDING_INTENT_IDENTITY_UNSUPPORTED' })
      if (typeof options.recordingId !== 'string' || !options.recordingId.trim())
        throw Object.assign(new Error('A registered recording ID is required'), { code: 'INVALID_ARGUMENT' })
    }
    const result = await call()
    if (planned && result.id !== options.recordingId)
      throw Object.assign(new Error('The native recording identity changed at start'), { code: 'RECORDING_CONFLICT' })
    return result
  })
}

function recordingCall<T>(options: { expectedId?: string } | undefined, supported: () => boolean, call: () => Promise<T>): Promise<T> {
  return afterBridge(() => {
    if (options && Object.hasOwn(options, 'expectedId')) {
      if (!supported())
        throw Object.assign(new Error('This host or adapter cannot protect recording ownership'), { code: 'RECORDING_OWNERSHIP_UNSUPPORTED' })
      if (typeof options.expectedId !== 'string' || !options.expectedId.trim())
        throw Object.assign(new Error('A saved recording ID is required'), { code: 'RECORDING_CONFLICT' })
    }
    return call()
  })
}

export const location: LocationApi = {
  supportsRecordingOwnership: locationRecordingOwnership,
  supportsRecordingIntentIdentity: locationRecordingIntentIdentity,
  acknowledgeRecording: options => recordingCall({ expectedId: options?.expectedId }, locationRecordingOwnership, () => craftLocation.acknowledgeRecording(options)),
  getCurrentPosition: options => afterBridge(() => craftLocation.getCurrentPosition(options)),
  watchPosition: (callback, options) => craftLocation.watchPosition(callback, options),
  clearWatch: watchId => craftLocation.clearWatch(watchId),
  startRecording: options => recordingStartCall(options, locationRecordingIntentIdentity, () => craftLocation.startRecording(options)),
  pauseRecording: options => recordingCall(options, locationRecordingOwnership, () => craftLocation.pauseRecording(options)),
  resumeRecording: options => recordingCall(options, locationRecordingOwnership, () => craftLocation.resumeRecording(options)),
  stopRecording: options => recordingCall(options, locationRecordingOwnership, () => craftLocation.stopRecording(options)),
  getRecordingState: options => recordingCall(options, locationRecordingOwnership, () => craftLocation.getRecordingState(options)),
  readRecording: options => recordingCall(options, locationRecordingOwnership, () => craftLocation.readRecording(options)),
}
export const notifications: NotificationsApi = {
  show: options => afterBridge(() => craftNotifications.show(options)),
  schedule: options => afterBridge(() => craftNotifications.schedule(options)),
  cancel: id => afterBridge(() => craftNotifications.cancel(id)),
  cancelAll: () => afterBridge(() => craftNotifications.cancelAll()),
  setBadge: count => afterBridge(() => craftNotifications.setBadge(count)),
}
export const permissions: PermissionsApi = {
  check: permission => afterBridge(() => craftPermissions.check(permission)),
  request: permission => afterBridge(() => craftPermissions.request(permission)),
  checkMultiple: list => afterBridge(() => craftPermissions.checkMultiple(list)),
  requestMultiple: list => afterBridge(() => craftPermissions.requestMultiple(list)),
  openSettings: () => afterBridge(() => craftPermissions.openSettings()),
}
export const secureStorage: SecureStorageApi = {
  set: (key, value) => afterBridge(() => craftSecureStorage.set(key, value)),
  get: key => afterBridge(() => craftSecureStorage.get(key)),
  delete: key => afterBridge(() => craftSecureStorage.delete(key)),
  clear: () => afterBridge(() => craftSecureStorage.clear()),
}
export const share: ShareApi = {
  share: options => afterBridge(() => craftShare.share(options)),
  isAvailable: () => craftShare.isAvailable(),
}
export const appReview: AppReviewApi = {
  request: () => afterBridge(() => craftAppReview.request()),
}

/**
 * Haptic feedback: UIImpactFeedbackGenerator, UINotificationFeedbackGenerator
 * and UISelectionFeedbackGenerator on iOS, a short vibration elsewhere.
 *
 * Never held for a bridge still loading, and never rejects: a tap played late
 * is a wrong tap, and feedback failing must not stop the flow it decorates.
 * `prepare()` wakes the Taptic Engine ahead of a likely tap (a finger landing
 * on a pressable), so the tap that follows plays without latency.
 */
export const haptics: HapticsApi = {
  impact: style => Promise.resolve().then(() => craftHaptics.impact(style)).catch(() => {}),
  notification: type => Promise.resolve().then(() => craftHaptics.notification(type)).catch(() => {}),
  selection: () => Promise.resolve().then(() => craftHaptics.selection()).catch(() => {}),
  vibrate: pattern => Promise.resolve().then(() => craftHaptics.vibrate(pattern)).catch(() => {}),
  prepare: (kind) => {
    const prepare = nativeFunctionNow('haptics.prepare')
    return prepare ? Promise.resolve().then(() => prepare(kind)).then(() => {}, () => {}) : Promise.resolve()
  },
}
export function normalizeDeepLinkURL(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null
  if (!value || typeof value !== 'object') return null
  const url = (value as { url?: unknown }).url
  return typeof url === 'string' && url.trim() ? url : null
}

/**
 * Deep links, asked of the bridge once there is one.
 *
 * A page mounts before Craft installs its bridge, and a page that follows its
 * links from mount (NativeAppShell does) asked too early: getInitialURL found
 * no bridge and answered null, and the launch link, delivered a moment later
 * marked `initial`, was skipped as already handled. An app opened from a link
 * landed on its home screen. Both calls now wait for the bridge; Craft holds
 * any link that arrives meanwhile until the first subscriber.
 */
export const deepLinks: DeepLinksApi = {
  async getInitialURL() {
    if (!await whenBridgeReady()) return null
    return normalizeDeepLinkURL(await craftDeepLinks.getInitialURL?.())
  },
  onLink(callback) {
    let stop: (() => void) | null = null
    let cancelled = false
    const subscribe = (): void => {
      if (cancelled) return
      stop = craftDeepLinks.onLink?.((value: unknown, link?: { initial?: boolean }) => {
        const url = normalizeDeepLinkURL(value)
        if (url) callback(url, { initial: link?.initial === true })
      }) ?? null
    }
    // Synchronous when the bridge is already there.
    if (host()?.craft) subscribe()
    else void whenBridgeReady().then(subscribe)
    return () => {
      cancelled = true
      stop?.()
    }
  },
}
/**
 * The page's side of native screens' first frame (see SnapshotsApi). The
 * shell's message handler exists from the first byte of the page, so this
 * needs no bridge: a call answers at once whether it was handed over.
 */
export const snapshots: SnapshotsApi = {
  isAvailable: () => craftSnapshots.isAvailable(),
  set: (name, value) => craftSnapshots.set(name, value),
  remove: name => craftSnapshots.remove(name),
  clear: () => craftSnapshots.clear(),
}
export const keepAwake: KeepAwakeApi = {
  enable: () => afterBridge(() => craftKeepAwake.enable()),
  disable: () => afterBridge(() => craftKeepAwake.disable()),
}
/**
 * The screen's brightness, 0 to 1, for a page that shows little for a long
 * time - a workout's big timer - and dims the backlight while it does. `set`
 * remembers the person's own level and `restore` puts it back; the page going
 * out of view (the app sent to the background, the phone locked) puts it back
 * too, and coming back re-applies the page's level. Off a phone there is no
 * backlight to set: `isAvailable()` is false and the calls resolve `null`.
 */
export const brightness: BrightnessApi = {
  isAvailable: () => craftBrightness.isAvailable(),
  get: () => afterBridge(() => craftBrightness.get()),
  set: level => afterBridge(() => craftBrightness.set(level)),
  restore: () => afterBridge(() => craftBrightness.restore()),
}

/**
 * What the Music app is playing, and its play/pause/skip, for a screen the
 * person trains with. iOS only, and only Apple Music: iOS gives no app another
 * player's controls (Spotify included), so then the song fields are null and
 * `otherAudioPlaying` is true. Nothing is read until `requestAuthorization()`,
 * which shows iOS's prompt once; call it from the person's tap. In a browser
 * and on Android every call answers `{ available: false }` and changes never
 * fire. Music control is local to the phone, so it works offline.
 */
export const music: MusicApi = {
  isAvailable: () => craftMusic.isAvailable(),
  supports: method => craftMusic.supports(method),
  getAuthorizationStatus: () => afterBridge(() => craftMusic.getAuthorizationStatus()),
  requestAuthorization: () => afterBridge(() => craftMusic.requestAuthorization()),
  getNowPlaying: () => afterBridge(() => craftMusic.getNowPlaying()),
  play: () => afterBridge(() => craftMusic.play()),
  pause: () => afterBridge(() => craftMusic.pause()),
  togglePlayPause: () => afterBridge(() => craftMusic.togglePlayPause()),
  skipToNext: () => afterBridge(() => craftMusic.skipToNext()),
  skipToPrevious: options => afterBridge(() => craftMusic.skipToPrevious(options)),
  // Subscribed once the bridge is there: earlier, craft.music did not exist
  // yet and the subscription would have been the browser's no-op for good.
  onChange: callback => subscribeWhenReady(() => craftMusic.onChange(callback)),
}

/**
 * A Bluetooth heart-rate strap (Polar, Garmin, Wahoo...), or a watch
 * broadcasting its heart rate, through the standard Heart Rate Service. iOS
 * only, in an app built with `capabilities.heartRate`: scan, connect (the
 * strap is remembered; `reconnect()` finds it next time without a scan), a
 * reading about once a second with its RR intervals, and a recording kept
 * natively, so a workout's heart rate survives the screen being locked and the
 * app being closed. Pass it to `createRouteRecorder({ heartRate })` to record
 * it with a route. In a browser and on Android it is unavailable: the state
 * says `available: false` and nothing fires. Bluetooth works offline.
 */
export const heartRate: HeartRateApi = {
  supportsRecordingOwnership: heartRateRecordingOwnership,
  supportsRecordingIntentIdentity: heartRateRecordingIntentIdentity,
  acknowledgeRecording: options => recordingCall({ expectedId: options?.expectedId }, heartRateRecordingOwnership, () => craftHeartRate.acknowledgeRecording(options)),
  isAvailable: () => craftHeartRate.isAvailable(),
  supports: method => craftHeartRate.supports(method),
  getState: () => afterBridge(() => craftHeartRate.getState()),
  requestAuthorization: () => afterBridge(() => craftHeartRate.requestAuthorization()),
  scan: options => afterBridge(() => craftHeartRate.scan(options)),
  stopScan: () => afterBridge(() => craftHeartRate.stopScan()),
  getDevices: () => afterBridge(() => craftHeartRate.getDevices()),
  connect: id => afterBridge(() => craftHeartRate.connect(id)),
  reconnect: () => afterBridge(() => craftHeartRate.reconnect()),
  disconnect: options => afterBridge(() => craftHeartRate.disconnect(options)),
  startRecording: options => recordingStartCall(options, heartRateRecordingIntentIdentity, () => craftHeartRate.startRecording(options)),
  pauseRecording: options => recordingCall(options, heartRateRecordingOwnership, () => craftHeartRate.pauseRecording(options)),
  resumeRecording: options => recordingCall(options, heartRateRecordingOwnership, () => craftHeartRate.resumeRecording(options)),
  stopRecording: options => recordingCall(options, heartRateRecordingOwnership, () => craftHeartRate.stopRecording(options)),
  getRecordingState: options => recordingCall(options, heartRateRecordingOwnership, () => craftHeartRate.getRecordingState(options)),
  readRecording: options => recordingCall(options, heartRateRecordingOwnership, () => craftHeartRate.readRecording(options)),
  // Subscribed once the bridge is there: earlier, craft.heartRate did not
  // exist yet and the subscription would have been the browser's no-op.
  onReading: callback => subscribeWhenReady(() => craftHeartRate.onReading(callback)),
  onDevice: callback => subscribeWhenReady(() => craftHeartRate.onDevice(callback)),
  onState: callback => subscribeWhenReady(() => craftHeartRate.onState(callback)),
}

/**
 * Short spoken cues ("Rest, 15 seconds"). In the app the voice ducks the
 * user's music and plays with the silent switch on; in a browser it falls back
 * to the Web Speech API.
 */
export const speech: SpeechApi = {
  isAvailable: () => craftSpeech.isAvailable(),
  speak: (text, options) => afterBridge(() => craftSpeech.speak(text, options)),
  stop: () => afterBridge(() => craftSpeech.stop()),
}

/**
 * Connectivity. A change subscription made before the bridge arrived listened
 * to the browser's online/offline events only, and never heard the native
 * monitor; it is made once the bridge is there.
 */
export const network: NetworkApi = {
  getStatus: () => afterBridge(() => craftNetwork.getStatus()),
  onChange: callback => subscribeWhenReady(() => craftNetwork.onChange(callback)),
}

export const pushNotifications: PushNotificationsApi = {
  register: () => afterBridge(() => craftPushNotifications.register()),
  onToken: callback => craftPushNotifications.onToken(callback),
  // A tap is handed over by the bridge's replay buffer, which exists only
  // once the bridge does; subscribed earlier, a cold-launch tap was missed.
  onNotification: callback => subscribeWhenReady(() => craftPushNotifications.onNotification(callback)),
}
export const health: HealthApi = {
  // Type names are plain strings to the shell, which refuses one it does not
  // know: Stacks can name a type (bloodGlucose) before the craft-native it
  // resolves does, and a page checks `supports` before asking for it.
  requestAuthorization: (types, options) => afterBridge(() => craftHealth.requestAuthorization(types as CraftHealthDataType[], options)),
  getData: (type, options) => afterBridge(() => craftHealth.getData(type as CraftHealthDataType, options)),
  saveWorkout: workout => afterBridge(() => craftHealth.saveWorkout(workout)),
  getWorkouts: options => afterBridge(() => craftHealth.getWorkouts(options)),
  getDailyStatistics: (type, options) => afterBridge(() => craftHealth.getDailyStatistics(type, options)),
  // Straight to the bridge rather than through craft-native, so an app that
  // resolves an older craft-native still reaches a shell that has the read.
  getHeartRateSamples: options => callNative<HealthHeartRateSample[]>('health.getHeartRateSamples', [options ?? {}], () => []).then(rows => Array.isArray(rows) ? rows : []),
  getSamples: (type, options) => callNative<HealthQuantitySample[]>('health.getSamples', [type, options ?? {}], () => []).then(rows => Array.isArray(rows) ? rows : []),
  getSleepIntervals: options => callNative<HealthSleepInterval[]>('health.getSleepIntervals', [options ?? {}], () => []).then(rows => Array.isArray(rows) ? rows : []),
  saveMindfulSession: session => callNative<HealthMindfulSessionResult | null>('health.saveMindfulSession', [session], () => null).then(saved => saved ?? null),
  getMindfulSessions: options => callNative<HealthMindfulSample[]>('health.getMindfulSessions', [options ?? {}], () => []).then(rows => Array.isArray(rows) ? rows : []),
  startHeartRateUpdates: options => callNative<boolean>('health.startHeartRateUpdates', [options ?? {}], () => false).then(started => started !== false),
  stopHeartRateUpdates: () => callNative<boolean>('health.stopHeartRateUpdates', [], () => true).then(() => true),
  onHeartRate: callback => onCraftEvent<{ samples?: unknown }>('craftHealthHeartRate', (detail) => {
    if (Array.isArray(detail.samples) && detail.samples.length) callback(detail.samples as HealthHeartRateSample[])
  }),
  supports: method => nativeFunctionNow(`health.${method}`) !== null,
}
export const liveActivities: LiveActivitiesApi = {
  start: options => afterBridge(() => craftLiveActivities.start(options)),
  update: state => afterBridge(() => craftLiveActivities.update(state)),
  end: () => afterBridge(() => craftLiveActivities.end()),
}
export const watchConnectivity: WatchConnectivityApi = {
  send: message => afterBridge(() => craftWatchConnectivity.send(message)),
  updateContext: context => afterBridge(() => craftWatchConnectivity.updateContext(context)),
  isReachable: () => afterBridge(() => craftWatchConnectivity.isReachable()),
  onMessage: callback => craftWatchConnectivity.onMessage(callback),
  onReachabilityChange: callback => craftWatchConnectivity.onReachabilityChange(callback),
}

/**
 * The launch splash Craft holds over the page until the page is ready, so the
 * app goes from its launch screen to content with no blank page in between.
 * `NativeAppShell` hides it once the first screen has painted.
 */
export const splash: { hide: () => boolean } = craftSplash

function host(): CraftHost | undefined {
  return craftHost()
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
  if (!current || !(current.craft || current.webkit?.messageHandlers?.craft))
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
  storage,
  crypto,
  share,
  appReview,
  deepLinks,
  keepAwake,
  brightness,
  music,
  heartRate,
  scheduledWorkouts,
  speech,
  network,
  pushNotifications,
  health,
  liveActivities,
  watchConnectivity,
  dialog,
  contextMenu,
  browser,
  symbols,
  statusBar,
  chrome,
  refresh,
  background,
  clipboard,
  db,
  files,
  shortcuts,
  widgets,
  orientation,
  auth,
  storeKit,
  isNativeMobile,
  whenNative: whenNativeMobile,
  onReady: onMobileReady,
  withFeedback: withNativeFeedback,
}

export { createVoiceRecorder, voiceRecordingFormData } from './voice-recorder'
export type { NativeVoiceFile, VoiceRecorder, VoiceRecorderOptions, VoiceRecorderSnapshot, VoiceRecorderStatus } from './voice-recorder'
