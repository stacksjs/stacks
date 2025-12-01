/**
 * SMS Service Configuration Types
 * Powered by AWS Pinpoint/SNS
 */

export interface SmsTemplateConfig {
  name: string
  body: string
  variables?: string[]
}

export interface SmsOptOutConfig {
  enabled: boolean
  keywords: string[] // STOP, UNSUBSCRIBE, etc.
}

export interface SmsTwoWayConfig {
  enabled: boolean
  webhookUrl?: string
  snsTopicArn?: string
}

export interface SmsOptions {
  enabled: boolean
  provider: 'pinpoint' | 'sns' | 'end-user-messaging'
  senderId?: string // Sender ID (where supported)
  originationNumber?: string // Phone number to send from
  defaultCountryCode: string
  messageType: 'TRANSACTIONAL' | 'PROMOTIONAL'
  maxSpendPerMonth?: number // Budget limit
  optOut: SmsOptOutConfig
  templates?: SmsTemplateConfig[]
  twoWay?: SmsTwoWayConfig
}

export type SmsConfig = Partial<SmsOptions>
