export type MobileOrientation = 'portrait' | 'landscape-left' | 'landscape-right' | 'portrait-upside-down'

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
  teamId?: string
  url?: string
  webAssets?: string
  fallbackWebAssets?: string
  output?: string
  darkMode?: boolean
  backgroundColor?: string
  urlSchemes?: string[]
  trustedOrigins?: string[]
  associatedDomains?: string[]
  appGroups?: string[]
  appIcon?: string
  privacy?: MobilePrivacyManifest
  orientations?: MobileOrientation[]
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
  appIcon?: string
  capabilities?: MobileCapabilities
}

export interface MobileConfig {
  ios: IosMobileConfig
  android?: AndroidMobileConfig
}
