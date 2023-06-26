import { defineSms } from '@stacksjs/utils'
import { env } from '@stacksjs/validation'

/**
 * **SMS Configuration**
 *
 * This configuration defines all of your email options. Because Stacks is fully-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default defineSms({
  default: 'twilio',

  from: env.FROM_PHONE_NUMBER || '',

  drivers: {
    twilio: {
      sid: env.TWILIO_ACCOUNT_SID || 'ACTEST',
      authToken: env.TWILIO_AUTH_TOKEN || '',
    },

    nexmo: {
      key: env.VONAGE_API_KEY || '',
      secret: env.VONAGE_API_SECRET || '',
    },

    gupshup: {
      user: env.GUPSHUP_USER_ID || '',
      password: env.GUPSHUP_PASSWORD || '',
    },

    plivo: {
      sid: env.PLIVO_ACCOUNT_ID || '',
      authToken: env.PLIVO_AUTH_TOKEN || '',
    },

    sms77: {
      key: env.SMS77_API_KEY || '',
    },

    sns: {
      region: env.SNS_REGION || '',
      key: env.SNS_ACCESS_KEY_ID || '',
      secret: env.SNS_SECRET_ACCESS_KEY || '',
    },

    telnyx: {
      key: env.TELNYX_API_KEY || '',
      messageProfileId: env.TELNYX_MESSAGE_PROFILE_ID || '',
    },

    termii: {
      key: env.TERMII_API_KEY || '',
    },
  },
})
