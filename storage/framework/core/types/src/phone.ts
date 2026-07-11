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

export interface PhoneNotificationConfig {
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
  incomingCall?: PhoneNotificationConfig
  missedCall?: PhoneNotificationConfig
  voicemail?: PhoneNotificationConfig
}

export type CallForwardingCondition = 'always' | 'business_hours' | 'after_hours'

export interface CallForwardingRule {
  name: string
  condition: CallForwardingCondition
  forwardTo: string
  ringTimeout: number
  priority: number
}

export interface CallForwardingConfig {
  enabled: boolean
  rules: CallForwardingRule[]
}

export interface PhoneOptions {
  enabled: boolean
  provider: 'connect' // Amazon Connect

  instance?: PhoneInstanceConfig
  phoneNumbers: PhoneNumberConfig[]
  notifications: PhoneNotificationsConfig
  voicemail: VoicemailConfig
  forwarding?: CallForwardingConfig
  businessHours?: BusinessHoursConfig
}

export type PhoneConfig = Partial<PhoneOptions>
