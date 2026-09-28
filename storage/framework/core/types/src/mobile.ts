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

export interface IosMobileConfig {
  appName: string
  bundleId: string
  version?: string
  buildNumber?: string
  deploymentTarget?: string
  watchDeploymentTarget?: string
  teamId?: string
  url?: string
  webAssets?: string
  fallbackWebAssets?: string
  output?: string
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
   * An edge swipe goes back (and forward) through the page's history, pushed
   * routes included, the way an iOS navigation stack does.
   */
  swipeNavigation?: boolean
  urlSchemes?: string[]
  trustedOrigins?: string[]
  associatedDomains?: string[]
  appGroups?: string[]
  appIcon?: string
  privacy?: MobilePrivacyManifest
  orientations?: MobileOrientation[]
  deviceFamilies?: IosDeviceFamily[]
  capabilities?: MobileCapabilities
}

export interface AndroidMobileConfig {
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
  /** Custom URI schemes handled by the app, for example `wildloop`. */
  urlSchemes?: string[]
  appIcon?: string
  /** Path to Firebase's google-services.json, required for production Android push registration. */
  googleServicesFile?: string
  capabilities?: MobileCapabilities
}

export interface MobileConfig {
  ios: IosMobileConfig
  android?: AndroidMobileConfig
}
