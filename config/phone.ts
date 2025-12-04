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
  enabled: true, // Set to true to enable phone features

  provider: 'connect', // Amazon Connect

  instance: {
    alias: envVars.CONNECT_INSTANCE_ALIAS || `${envVars.APP_NAME?.toLowerCase() || 'stacks'}-phone`,
    inboundCallsEnabled: true,
    outboundCallsEnabled: true,
  },

  phoneNumbers: [
    {
      type: 'TOLL_FREE',
      countryCode: 'US',
      description: 'Main business line',
      notifyOnCall: ['chris@stacksjs.com'],
    },
  ],

  notifications: {
    incomingCall: {
      enabled: true,
      channels: ['email', 'sms'], // 'email', 'sms', 'slack', 'webhook'
    },
    missedCall: {
      enabled: true,
      channels: ['email', 'sms'],
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
    greeting: 'Thank you for calling Stacks. Please leave a message after the tone and we will get back to you as soon as possible.',
  },

  // Call forwarding configuration
  forwarding: {
    enabled: true,
    rules: [
      {
        name: 'Forward to Chris (Business Hours)',
        condition: 'always', // Forward all calls during business hours
        forwardTo: '+18088218241',
        ringTimeout: 20, // seconds before going to voicemail
        priority: 1,
      },
      {
        name: 'Forward to Chris (After Hours)',
        condition: 'after_hours', // Forward outside business hours
        forwardTo: '+18088218241',
        ringTimeout: 15,
        priority: 2,
      },
    ],
  },

  businessHours: {
    timezone: 'America/Los_Angeles',
    schedule: [
      { day: 'MONDAY', start: '11:30', end: '20:00' },
      { day: 'TUESDAY', start: '11:30', end: '20:00' },
      { day: 'WEDNESDAY', start: '11:30', end: '20:00' },
      { day: 'THURSDAY', start: '11:30', end: '20:00' },
      { day: 'FRIDAY', start: '11:30', end: '20:00' },
      { day: 'SATURDAY', start: '11:30', end: '20:00' },
      { day: 'SUNDAY', start: '11:30', end: '20:00' },
    ],
  },
} satisfies PhoneConfig
