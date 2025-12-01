/**
 * Phone/Voice Service Configuration Types
 * Powered by Amazon Connect
 */

export interface PhoneNumberConfig {
  type: 'TOLL_FREE' | 'DID' | 'UIFN'
  countryCode: string
  description?: string
  contactFlowId?: string
  notifyOnCall?: string[] // team member emails/phones
}

export interface NotificationConfig {
  enabled: boolean
  channels: ('email' | 'sms' | 'slack' | 'webhook')[]
  webhookUrl?: string
  slackChannel?: string
}

export interface BusinessHoursSchedule {
  day: 'SUNDAY' | 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY'
  start: string // HH:MM format
  end: string // HH:MM format
}

export interface BusinessHoursConfig {
  timezone: string
  schedule: BusinessHoursSchedule[]
}

export interface VoicemailConfig {
  enabled: boolean
  transcription: boolean
  maxDurationSeconds: number
  greeting?: string
}

export interface PhoneInstanceConfig {
  alias: string
  inboundCallsEnabled: boolean
  outboundCallsEnabled: boolean
}

export interface PhoneNotificationsConfig {
  incomingCall?: NotificationConfig
  missedCall?: NotificationConfig
  voicemail?: NotificationConfig
}

export interface PhoneOptions {
  enabled: boolean
  provider: 'connect' // Amazon Connect

  instance?: PhoneInstanceConfig
  phoneNumbers: PhoneNumberConfig[]
  notifications: PhoneNotificationsConfig
  voicemail: VoicemailConfig
  businessHours?: BusinessHoursConfig
}

export type PhoneConfig = Partial<PhoneOptions>
