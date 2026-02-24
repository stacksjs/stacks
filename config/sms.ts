import type { SmsConfig } from '@stacksjs/types'
import { env } from '@stacksjs/env'

/**
 * **SMS Configuration**
 *
 * This configuration defines your SMS service options.
 * Supports Twilio, Vonage, and AWS Pinpoint providers.
 */
export default {
  enabled: false, // Set to true to enable SMS features

  /**
   * Default SMS provider
   * Options: 'twilio' | 'vonage' | 'pinpoint'
   */
  provider: 'twilio',

  /**
   * Default sender ID or phone number
   */
  from: env.SMS_FROM_NUMBER,

  /**
   * Default country code for phone number formatting
   */
  defaultCountryCode: 'US',

  /**
   * Message type (affects pricing and delivery)
   */
  messageType: 'TRANSACTIONAL', // TRANSACTIONAL or PROMOTIONAL

  /**
   * Provider-specific configurations
   */
  drivers: {
    twilio: {
      accountSid: env.TWILIO_ACCOUNT_SID || '',
      authToken: env.TWILIO_AUTH_TOKEN || '',
      from: env.TWILIO_FROM_NUMBER,
      messagingServiceSid: env.TWILIO_MESSAGING_SERVICE_SID,
      // For 2FA/OTP verification
      // verifyServiceSid: env.TWILIO_VERIFY_SERVICE_SID,
    },

    vonage: {
      apiKey: env.VONAGE_API_KEY || '',
      apiSecret: env.VONAGE_API_SECRET || '',
      from: env.VONAGE_FROM_NUMBER,
      // For JWT authentication (optional)
      // applicationId: env.VONAGE_APPLICATION_ID,
      // privateKey: env.VONAGE_PRIVATE_KEY,
    },

    pinpoint: {
      region: env.AWS_REGION || 'us-east-1',
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      senderId: env.SMS_SENDER_ID,
      originationNumber: env.SMS_ORIGINATION_NUMBER,
    },
  },

  /**
   * Monthly spending limit (USD)
   */
  maxSpendPerMonth: 100,

  /**
   * Opt-out handling configuration
   */
  optOut: {
    enabled: true,
    keywords: ['STOP', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'],
  },

  /**
   * Message templates
   */
  templates: [
    // {
    //   name: 'verification',
    //   body: 'Your verification code is {code}. Valid for 10 minutes.',
    //   variables: ['code'],
    // },
    // {
    //   name: 'welcome',
    //   body: 'Welcome to {appName}! Reply HELP for assistance.',
    //   variables: ['appName'],
    // },
  ],

  /**
   * Two-way messaging configuration
   */
  twoWay: {
    enabled: false,
    // webhookUrl: 'https://your-app.com/api/sms/webhook',
  },
} satisfies SmsConfig
