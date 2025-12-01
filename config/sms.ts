import type { SmsConfig } from '@stacksjs/types'

// Use direct environment variable access to avoid circular dependencies
const envVars = typeof Bun !== 'undefined' ? Bun.env : process.env

/**
 * **SMS Configuration**
 *
 * This configuration defines your SMS service options.
 * Powered by AWS Pinpoint for reliable SMS delivery.
 */
export default {
  enabled: false, // Set to true to enable SMS features

  provider: 'pinpoint', // AWS Pinpoint

  senderId: envVars.SMS_SENDER_ID, // Sender ID (where supported by country)
  originationNumber: envVars.SMS_ORIGINATION_NUMBER, // Phone number to send from

  defaultCountryCode: 'US',
  messageType: 'TRANSACTIONAL', // TRANSACTIONAL or PROMOTIONAL

  maxSpendPerMonth: 100, // Budget limit in USD

  optOut: {
    enabled: true,
    keywords: ['STOP', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'],
  },

  templates: [
    // Example templates
    // {
    //   name: 'verification',
    //   body: 'Your verification code is {{code}}. Valid for 10 minutes.',
    //   variables: ['code'],
    // },
    // {
    //   name: 'welcome',
    //   body: 'Welcome to {{appName}}! Reply HELP for assistance.',
    //   variables: ['appName'],
    // },
  ],

  twoWay: {
    enabled: false,
    // webhookUrl: 'https://your-app.com/api/sms/webhook',
  },
} satisfies SmsConfig
