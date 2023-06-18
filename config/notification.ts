import { defineNotification } from 'stacks/core/utils/src'
import { env } from 'stacks/core/validation/src'

/**
 * **Notification Configuration**
 *
 * This configuration defines all of your notification options. Because Stacks is fully-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default defineNotification({
  default: 'email',

  email: {
    default: 'smtp',

    from: {
      name: env.MAIL_FROM_NAME || 'Stacks',
      address: env.MAIL_FROM_ADDRESS || 'no-reply@stacksjs.dev',
    },

    drivers: {
      smtp: {
        host: 'smtp.example.com',
        port: 465,
        secure: true, // use TLS
        auth: {
          user: 'username',
          pass: 'password',
        },
      },

      emailjs: {
        host: env.EMAILJS_HOST || 'example.com',
        user: env.EMAILJS_USERNAME || '',
        password: env.EMAILJS_PASSWORD || '',
        port: env.EMAILJS_PORT || 40,
        secure: env.EMAILJS_SECURE || true,
      },

      mailgun: {
        key: env.MAILGUN_API_KEY || '',
        domain: env.MAILGUN_DOMAIN || '',
        username: env.MAILGUN_USERNAME || '',
      },

      mailjet: {
        key: env.MAILJET_API_KEY || '',
        secret: env.MAILJET_API_SECRET || '',
      },

      mandrill: {
        key: env.MANDRILL_API_KEY || '',
      },

      netcore: {
        key: env.NETCORE_API_KEY || '',
      },

      nodemailer: {
        host: env.NODEMAILER_HOST || '',
        user: env.NODEMAILER_USERNAME || '',
        password: env.NODEMAILER_PASSWORD || '',
        port: env.NODEMAILER_PORT || 40,
        secure: env.NODEMAILER_SECURE || true,
      },

      postmark: {
        key: env.POSTMARK_API_KEY || '',
      },

      sendgrid: {
        key: env.SENDGRID_API_KEY || '',
        senderName: env.SENDGRID_SENDER_NAME || '',
      },

      ses: {
        region: env.SES_REGION || '',
        key: env.SES_ACCESS_KEY_ID || '',
        secret: env.SES_SECRET_ACCESS_KEY || '',
      },
    },
  },

  sms: {
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
  },

  chat: {
    default: 'slack',
    from: env.SLACK_FROM || '',

    drivers: {
      slack: {
        appId: env.SLACK_APPLICATION_ID || '',
        clientId: env.SLACK_CLIENT_ID || '',
        secret: env.SLACK_SECRET_KEY || '',
      },

      msTeams: {
        appId: env.MICROSOFT_TEAMS_APPLICATION_ID || '',
        clientId: env.MICROSOFT_TEAMS_CLIENT_ID || '',
        secret: env.MICROSOFT_TEAMS_SECRET || '',
      },

      discord: {
        // wip
      },
    },
  },
})
