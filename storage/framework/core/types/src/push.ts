/**
 * Push Notification Configuration Types
 * Supports APNs (Apple) and FCM (Firebase/Google)
 */

/**
 * Apple Push Notification Service (APNs) configuration
 */
export interface APNsProviderConfig {
  /** APNs Key ID from Apple Developer Portal */
  keyId: string
  /** Team ID from Apple Developer Portal */
  teamId: string
  /** Path to the private key file (p8) or the key content */
  privateKey: string
  /** iOS app bundle ID (e.g., com.example.app) */
  bundleId: string
  /** Use production APNs server (default: false for sandbox) */
  production?: boolean
}

/**
 * Firebase Cloud Messaging (FCM) configuration
 */
export interface FCMProviderConfig {
  /** Firebase project ID */
  projectId: string
  /** Service account client email */
  clientEmail: string
  /** Service account private key (PEM format) */
  privateKey: string
}

/**
 * Push notification provider configuration
 */
export interface PushProviderOptions {
  /** APNs configuration (optional) */
  apns?: APNsProviderConfig
  /** FCM configuration (optional) */
  fcm?: FCMProviderConfig
}

/**
 * Push notification options
 */
export interface PushOptions {
  /** Enable push notifications */
  enabled: boolean
  /** Default provider to use */
  defaultProvider?: 'apns' | 'fcm'
  /** Provider configurations */
  providers: PushProviderOptions
}

/**
 * Push notification configuration type
 */
export type PushConfig = Partial<PushOptions>

// Legacy types for backwards compatibility
export interface FCMPushNotificationOptions {
  eventName: string
  to: {
    subscriberId: string
  }
  payload: {
    deviceTokens: Array<string>
    badge: boolean
    clickAction: string
    color: string
    icon: string
    sound: string
  }
}

export interface ExpoPushNotificationOptions {
  eventName: string
  to: {
    subscriberId: string
  }
  payload: {
    to: string[]
    data: object
    title: string
    body: string
    ttl: number
    expiration: number
    priority: 'default' | 'normal' | 'high'
    subtitle: string
    sound: 'default' | null
    badge: number
    channelId: string
    categoryId: string
    mutableContent: boolean
  }
}
