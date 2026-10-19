export type MobileOrientation = 'portrait' | 'landscape-left' | 'landscape-right' | 'portrait-upside-down'
export type IosDeviceFamily = 'iphone' | 'ipad'

export interface MobileCapabilities {
  speechRecognition?: boolean
  haptics?: boolean
  share?: boolean
  camera?: boolean
  biometric?: boolean
  pushNotifications?: boolean
  secureStorage?: boolean
  geolocation?: boolean
  backgroundLocation?: boolean
  clipboard?: boolean
  contacts?: boolean
  calendar?: boolean
  localNotifications?: boolean
  inAppPurchase?: boolean
  keepAwake?: boolean
  orientationLock?: boolean
  deepLinks?: boolean
  qrScanner?: boolean
  /** Reach the person's own devices on the same network (a Mac companion); iOS asks first. */
  localNetwork?: boolean
  filePicker?: boolean
  fileDownload?: boolean
  socialAuth?: boolean
  audioRecording?: boolean
  videoRecording?: boolean
  motionSensors?: boolean
  localDatabase?: boolean
  bluetooth?: boolean
  nfc?: boolean
  healthKit?: boolean
  healthConnect?: boolean
  /**
   * iOS: show and steer what the Music app is playing (`music` from
   * @stacksjs/mobile). Apple Music only; iOS asks for media library access
   * the first time the page calls `music.requestAuthorization()`.
   */
  appleMusic?: boolean
  /**
   * iOS: read a Bluetooth heart-rate strap, or a watch broadcasting its heart
   * rate (`heartRate` from @stacksjs/mobile). Adds the `bluetooth-central`
   * background mode so a workout keeps reading it with the screen locked; iOS
   * asks for Bluetooth the first time the page scans or connects.
   */
  heartRate?: boolean
  /**
   * iOS: keep sound playing with the screen locked (a sleep soundscape, a
   * meditation's ambience). Adds the `audio` background mode; App Review
   * expects an app that asks for it to play audible content.
   */
  backgroundAudio?: boolean
  /**
   * iOS 17+: schedule structured workouts onto the paired Apple Watch
   * (`scheduledWorkouts` from @stacksjs/mobile, WorkoutKit's
   * WorkoutScheduler). Only an app with it compiles in and links WorkoutKit;
   * iOS asks the person the first time the page calls
   * `scheduledWorkouts.requestAuthorization()`.
   */
  scheduledWorkouts?: boolean
  liveActivities?: boolean
  watchApp?: boolean
  backgroundTasks?: boolean
  screenCapture?: boolean
  pdfViewer?: boolean
  augmentedReality?: boolean
  machineLearning?: boolean
}

export interface MobilePrivacyDataType {
  type: string
  linked?: boolean
  tracking?: boolean
  purposes: string[]
}

export interface MobilePrivacyAccessedApiType {
  type: string
  reasons: string[]
}

export interface MobilePrivacyManifest {
  tracking?: boolean
  trackingDomains?: string[]
  collectedDataTypes?: MobilePrivacyDataType[]
  accessedApiTypes?: MobilePrivacyAccessedApiType[]
}

/** iOS waking the app now and then to refresh its content (BGAppRefreshTask). */
export interface IosBackgroundRefreshConfig {
  enabled: boolean
  /** The task's identifier, reverse-DNS. Craft derives one from the bundle id when left out. */
  identifier?: string
  /** The soonest iOS may run it again after the last time, in minutes. iOS decides the rest. */
  minimumIntervalMinutes?: number
}

/** Custom native text fonts; the key is the font's PostScript name on both phones. */
export type NativeFontsConfig = Record<string, { src: string, license?: string }>

export interface IosMobileConfig {
  /** Build-owned App Intents and home-screen actions, routed into the app. */
  appShortcuts?: Array<{ id: string, title: string, subtitle?: string, symbol: string, url: string, phrases: string[] }>
  nativeFonts?: NativeFontsConfig
  appName: string
  bundleId: string
  version?: string
  buildNumber?: string
  /**
   * The oldest iOS the app runs on. Craft's default suits most apps; the
   * Liquid Glass tab bar and chrome need iOS 26 at run time, and older
   * systems get the classic bars, so raising it is a product decision rather
   * than a requirement.
   */
  deploymentTarget?: string
  watchDeploymentTarget?: string
  teamId?: string
  url?: string
  webAssets?: string
  fallbackWebAssets?: string
  output?: string
  /** Package-owned Swift is generated into the build directory and restored after Xcode Cloud clones the project. */
  shell?: {
    /** Bun version installed by ci_post_clone when Bun is unavailable. Defaults to the version generating the project. */
    bunVersion?: string
  }
  /** Reusable simulator test host, configured in TypeScript rather than app-owned Swift. */
  simulator?: {
    output?: string
    projectName?: string
    bundleIdPrefix?: string
    deploymentTarget?: string
    controlUrl?: string
  }
  /** Pins the interface to Dark (`true`) or Light (`false`). See `appearance`. */
  darkMode?: boolean
  /**
   * `system` follows the phone's Light/Dark setting, and the page's
   * `prefers-color-scheme` with it; `light` and `dark` pin one. Takes
   * precedence over `darkMode`.
   */
  appearance?: 'light' | 'dark' | 'system'
  backgroundColor?: string
  /** The launch and webview background while the phone is in Dark Mode. */
  backgroundColorDark?: string
  /**
   * Who answers an edge swipe back. `router` (the default): the stx router's
   * own interactive swipe, which drags the previous screen in under the
   * finger as UINavigationController does, so WebKit's history gesture is
   * left off. `webview`: WebKit's back/forward swipe, for an app whose pages
   * are not on the stx router.
   */
  swipeBack?: 'router' | 'webview'
  /**
   * WebKit's own back/forward edge swipe through the page's history. Off by
   * default, because the stx router swipes back itself and the two would
   * fight over one gesture; `swipeBack` is the clearer way to choose. Set
   * explicitly, it wins.
   */
  swipeNavigation?: boolean
  /** A long press on a link previews it (WebKit's link preview). Off by default, as in native apps. */
  allowsLinkPreview?: boolean
  /** The previous/next/Done bar iOS puts above the keyboard. Off by default, as in native apps. */
  keyboardAccessory?: boolean
  /** Pinch and double-tap zoom off, as a native screen does not zoom. On by default. */
  disableZoom?: boolean
  /** The longest the launch screen waits for the first page to paint, in seconds. Craft's default is 3. */
  splashMaxSeconds?: number
  /** How long the first page load may take before the offline fallback, in seconds. Craft's default is 10. */
  requestTimeoutSeconds?: number
  backgroundRefresh?: IosBackgroundRefreshConfig
  urlSchemes?: string[]
  trustedOrigins?: string[]
  /**
   * Domains the app's web view treats as its own (WKAppBoundDomains). iOS runs
   * service workers, and so offline support, only on these. Unset, Craft uses
   * the hosts of `trustedOrigins`; `[]` declares none.
   */
  appBoundDomains?: string[]
  /**
   * Confine the web view to {@link IosMobileConfig.appBoundDomains}, which is
   * what actually turns the app-bound APIs on.
   *
   * Declaring the domains is only half of it. iOS grants service workers, and
   * so offline support, only to a web view that has *also* opted into the
   * restriction, by setting `limitsNavigationsToAppBoundDomains` on its
   * configuration. Without this, `WKAppBoundDomains` lands in Info.plist and
   * changes nothing, and a service worker silently never registers
   * (stacksjs/stacks#2878).
   *
   * Defaults to on when {@link IosMobileConfig.appBoundDomains} lists at least
   * one domain, because nothing else declares those domains for, and getting
   * the plist key without the APIs is the surprising outcome. Not keyed on
   * `trustedOrigins`, which every app has.
   *
   * The cost is why it remains settable: the web view may then navigate only
   * to those domains, so an app that legitimately sends its web view elsewhere
   * sets this to `false` explicitly, which wins over the default.
   *
   * Craft's config key deliberately drops the `s` that Apple's property has;
   * Craft maps one onto the other.
   */
  limitNavigationsToAppBoundDomains?: boolean
  /**
   * Universal links and shared credentials: `applinks:example.com`,
   * `webcredentials:example.com`. The site serves the matching
   * apple-app-site-association file.
   */
  associatedDomains?: string[]
  /**
   * Screens drawn natively instead of in the web view: an app path to the
   * name of a `.stx` screen in `nativeScreensDir`, e.g.
   * `{ '/m': 'Today', '/m/calendar': 'Calendar' }`. `buddy build:ios`
   * compiles those screens with stx into the app, every other path stays in
   * the web view, and a screen that is missing or throws falls back to the
   * page. A segment may be a parameter (`/m/workout/:id`), the last one `*`.
   */
  nativeScreens?: Record<string, string>
  /** Where the native screens' `.stx` files live. Default `resources/native`. */
  nativeScreensDir?: string
  /**
   * What draws the app. `web` (the default) is a web view, with the paths in
   * `nativeScreens` drawn natively over it. `native` is no web view at all:
   * every path the app opens is a native screen from `nativeScreens`, the
   * tabs are `tabs`, and a path no screen draws opens in the in-app browser
   * against `url`, which stays the app's site (its path is the start screen).
   * The page's services then belong in `nativeApp`.
   */
  renderer?: 'web' | 'native'
  /**
   * The app script (relative to the project): a module whose default export
   * runs once, for the app's life, beside the native screens, with the same
   * `craft` bridge (stx's `compileNativeBundle` `app`). What does not belong
   * to one screen lives there: push registration and a tapped notification,
   * background refresh, keeping the account fresh. With it, the app's
   * notification taps, silent pushes and background refreshes reach it
   * instead of the page.
   */
  nativeApp?: string
  /**
   * Where native screens run their JavaScript: `main` (the default) or
   * `background`, a thread of the screens' own, so a screen's script, its
   * timers and its renders never hold the main thread while it scrolls or
   * animates. UIKit still draws on main; a pushed screen waits for its first
   * render (at most 0.3 s) so it never slides in empty.
   */
  nativeScriptThread?: 'main' | 'background'
  /**
   * The native tab bar from the first frame, before the page has loaded and
   * described its own: each tab's root path, title and SF Symbol. The page's
   * NativeTabBar replaces it once it mounts. An app with native screens needs
   * this, or the first screen shows without its tabs.
   */
  tabs?: Array<{ id: string, title: string, symbol?: string }>
  /**
   * Web-storage keys native screens need, mirrored into the Keychain under
   * the name given: `{ auth_token: 'auth.token' }` lets a native screen read
   * the page's sign-in with `craft.secureStorage.getSync('auth.token')`.
   */
  shareStorage?: Record<string, string>
  appGroups?: string[]
  appIcon?: string
  /**
   * The logo on the launch screen, on `backgroundColor`. Craft holds it on
   * screen until the first page has painted (NativeAppShell says when), so
   * the app goes from launch to content without a blank web view between.
   * PNG, PDF or SVG, drawn at its own size in points.
   */
  splash?: {
    image?: string
    /** The logo in Dark Mode, on `backgroundColorDark`. */
    imageDark?: string
  }
  privacy?: MobilePrivacyManifest
  /**
   * Purpose strings in the app's own words, by Info.plist key, e.g.
   * `{ NSAppleMusicUsageDescription: 'Shows the song playing during a workout.' }`.
   * Each replaces the generic sentence Craft writes for that key.
   */
  usageDescriptions?: Record<string, string>
  orientations?: MobileOrientation[]
  deviceFamilies?: IosDeviceFamily[]
  capabilities?: MobileCapabilities
  /** Crash reporting for iOS, over `MobileConfig.crashReporting`. */
  crashReporting?: MobileCrashReportingConfig
}

export interface AndroidMobileConfig {
  /** Native map view generated by Craft. MapLibre needs no Google Maps SDK key. */
  mapProvider?: 'google' | 'maplibre'
  nativeFonts?: NativeFontsConfig
  appName: string
  packageName: string
  version?: string
  versionCode?: number
  minSdk?: number
  targetSdk?: number
  url?: string
  webAssets?: string
  fallbackWebAssets?: string
  output?: string
  darkMode?: boolean
  backgroundColor?: string
  trustedOrigins?: string[]
  /** Verified HTTPS hosts. Ordered `*` path rules keep excluded website pages in the browser. */
  appLinks?: Array<{ host: string, paths?: Array<{ pattern: string, exclude?: boolean }> }>
  /** Custom URI schemes handled by the app, for example `wildloop`. */
  urlSchemes?: string[]
  appIcon?: string
  /**
   * The small icon in the status bar and on every notification: an Android
   * vector drawable (`.xml`) or a `.png`, white on transparent, since
   * Android draws only its shape. The launcher icon there is a white square.
   */
  notificationIcon?: string
  /** The `#RRGGBB` Android tints the notification icon and app name with. */
  notificationColor?: string
  /** Path to Firebase's google-services.json, required for production Android push registration. */
  googleServicesFile?: string
  /** Google Maps Android SDK key for native Map views, restricted to this application. */
  mapsApiKey?: string
  /** Light or dark with the device (`system`), or pinned. */
  appearance?: 'light' | 'dark' | 'system'
  /** The background behind screens in dark mode (`backgroundColor` is light's). */
  backgroundColorDark?: string
  /**
   * `native` draws every screen from the app's `.stx` screens with Android
   * views and no web view, as the iOS app does (`ios.renderer`). It needs
   * `nativeScreens`; `url` is then the app's site, where its API answers.
   */
  renderer?: 'web' | 'native'
  /** Paths to the screens that draw them (`/m/workout/:id` → `Workout`), as `ios.nativeScreens`. */
  nativeScreens?: Record<string, string>
  /** Where the screens' `.stx` files are (default `resources/native`). */
  nativeScreensDir?: string
  /** The script that runs beside the screens for the app's life (`ios.nativeApp`). */
  nativeApp?: string
  /** The tab bar: each tab's root path, title and symbol (an SF Symbol name, drawn with Android's glyphs). */
  tabs?: Array<{ id: string, title: string, symbol?: string }>
  /**
   * Wake the app script in the background (`craftBackgroundRefresh`)
   * through WorkManager, at least this many minutes apart (15 at the least).
   */
  backgroundRefresh?: { enabled?: boolean, minimumIntervalMinutes?: number }
  /**
   * The Health Connect data the app reads and writes (`capabilities.healthConnect`),
   * by the shared type names. Play reviews each declared permission, so the
   * manifest lists only these. `background` reads while the app is closed
   * (Android 15), `history` reads past the 30 days before the first grant.
   */
  healthConnect?: {
    read?: AndroidHealthConnectType[]
    write?: AndroidHealthConnectType[]
    background?: boolean
    history?: boolean
  }
  /** The app's privacy policy, linked from Health Connect's permission screen. */
  privacyPolicyUrl?: string
  capabilities?: MobileCapabilities
  /** Crash reporting for Android, over `MobileConfig.crashReporting`. */
  crashReporting?: MobileCrashReportingConfig
}

/** Health data types, by the names the iOS build's HealthKit uses. */
export type AndroidHealthConnectType = 'steps' | 'heartRate' | 'activeEnergy' | 'distance' | 'workouts' | 'restingHeartRate'
  | 'heartRateVariability' | 'bodyMass' | 'sleep' | 'mindful' | 'dietaryEnergy' | 'dietaryProtein'
  | 'dietaryCarbohydrates' | 'dietaryFat'

/**
 * One kind of application content a device may index for search.
 *
 * iOS indexes what an app donates as an `NSUserActivity`, and hands a tapped
 * activity back only for an activity type the build declares in `Info.plist` —
 * a list fixed at build time. A type per record id would be unbounded, so each
 * kind gets a fixed number of slots and each slot holds whichever record is
 * currently in it; the oldest donation makes room for the next.
 *
 * That is why `slots` is a budget rather than "index everything": every slot is
 * one line in the generated `Info.plist` and one possible donation at launch.
 */
export interface SpotlightKindConfig {
  /** How many records of this kind the device holds at once. 1 to 64. */
  slots: number
  /** Where a tapped entry opens, with `:id` standing for the record's id. */
  route: string
  /** Names an entry whose record arrived without a name of its own. */
  noun?: string
}

/** What the app lets a device index, and under what identifiers. */
export interface SpotlightConfig {
  /**
   * Index content at all. Defaults to true when any kind is configured.
   *
   * False declares no activity types and leaves every runtime call a no-op —
   * the switch to throw when a device index has to be withdrawn without
   * unpicking the call sites.
   */
  enabled?: boolean

  /**
   * The kinds, keyed by the name their slots are donated under: `trail` gives
   * `trail-slot-0` and so on. The name is part of what the device has already
   * indexed, so renaming one orphans whatever it donated until those slots are
   * donated over.
   */
  kinds: Record<string, SpotlightKindConfig>

  /**
   * Activity types the app donates itself, by bare action name.
   *
   * For anything indexed outside the slot registry — a donated Siri phrase, an
   * App Intent — which needs declaring in `Info.plist` just the same or iOS
   * keeps the tap to itself.
   */
  activityTypes?: string[]
}

/**
 * Crash and error reporting to bughq (https://bughq.org) from the native app:
 * crashes, hangs and ANRs, uncaught JavaScript errors in native screens, the
 * app script and web views, sent from an on-disk outbox so offline events
 * arrive later. On when a `key` is set. `MobileConfig.crashReporting` applies
 * to both platforms; `ios.crashReporting` and `android.crashReporting`
 * override it field by field (a project, and so a key, per platform).
 */
export interface MobileCrashReportingConfig {
  /** The bughq project's public ingest key. It ships in the app, which is safe. Unset turns reporting off. */
  key?: string
  /** The bughq host. Default https://bughq.org. */
  host?: string
  /** Default `production`. */
  environment?: string
  /** Every event and session names it. Default `<version>+<build>`, e.g. `1.0.0+41`. */
  release?: string
  /** One session per launch, for crash-free sessions per release. Default true. */
  sessions?: boolean
  /**
   * Upload release builds' symbols so stacks are readable: dSYMs from Xcode
   * Cloud (`ci_scripts/ci_post_xcodebuild.sh`) and the R8 mapping after
   * `buddy build:android --bundle`. Needs the secret `BUGHQ_UPLOAD_TOKEN` in
   * that build's environment, never in the app. Default true.
   */
  uploadSymbols?: boolean
}

export interface MobileConfig {
  ios: IosMobileConfig
  android?: AndroidMobileConfig
  /** Crash reporting for both platforms (see MobileCrashReportingConfig). */
  crashReporting?: MobileCrashReportingConfig
  /**
   * Content a device may index for search: iOS Spotlight and Siri today,
   * through the activity types the iOS build declares from this.
   */
  spotlight?: SpotlightConfig
}
