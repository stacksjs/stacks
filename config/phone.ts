import type { PhoneConfig } from '@stacksjs/types'

// Use direct environment variable access to avoid circular dependencies
const envVars = typeof Bun !== 'undefined' ? Bun.env : process.env

/**
 * **Phone Configuration**
 *
 * This configuration defines your phone/voice service options.
 * Powered by Amazon Connect for enterprise-grade telephony.
 */
export default {
  enabled: false, // Set to true to enable phone features

  provider: 'connect', // Amazon Connect

  instance: {
    alias: envVars.CONNECT_INSTANCE_ALIAS || `${envVars.APP_NAME?.toLowerCase() || 'stacks'}-phone`,
    inboundCallsEnabled: true,
    outboundCallsEnabled: true,
  },

  phoneNumbers: [
    // Example phone number configuration
    // {
    //   type: 'TOLL_FREE',
    //   countryCode: 'US',
    //   description: 'Main support line',
    //   notifyOnCall: ['chris@stacksjs.com'],
    // },
  ],

  notifications: {
    incomingCall: {
      enabled: true,
      channels: ['email'], // 'email', 'sms', 'slack', 'webhook'
    },
    missedCall: {
      enabled: true,
      channels: ['email'],
    },
    voicemail: {
      enabled: true,
      channels: ['email'],
    },
  },

  voicemail: {
    enabled: true,
    transcription: true, // Use Amazon Transcribe
    maxDurationSeconds: 120,
    greeting: 'Please leave a message after the tone.',
  },

  businessHours: {
    timezone: 'America/Los_Angeles',
    schedule: [
      { day: 'MONDAY', start: '09:00', end: '17:00' },
      { day: 'TUESDAY', start: '09:00', end: '17:00' },
      { day: 'WEDNESDAY', start: '09:00', end: '17:00' },
      { day: 'THURSDAY', start: '09:00', end: '17:00' },
      { day: 'FRIDAY', start: '09:00', end: '17:00' },
    ],
  },
} satisfies PhoneConfig
