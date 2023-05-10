import { defineNotification, env } from '@stacksjs/utils'

/**
 * **Notification Configuration**
 *
 * This configuration defines all of your notification options. Because Stacks is fully-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default defineNotification({
  type: env('NOTIFICATION_TYPE', 'email'),
  driver: env('NOTIFICATION_DRIVER', 'sendgrid'),

  email: {
    purgeCSS: false,

    sendgrid: {
      key: env('SENDGRID_API_KEY', 'test-value'),
      from: env('SENDGRID_FROM', 'test-value'),
      senderName: env('SENDGRID_SENDER_NAME', 'test-value'),
    },

    emailjs: {
      from: env('EMAILJS_FROM_EMAIL', 'test-value'),
      host: env('EMAILJS_HOST', 'test-value'),
      user: env('EMAILJS_USERNAME', 'test-value'),
      password: env('EMAILJS_PASSWORD', 'test-value'),
      port: env('EMAILJS_PORT', 40),
      secure: env('EMAILJS_SECURE', true),
    },

    mailgun: {
      key: env('MAILGUN_API_KEY', 'test-value'),
      domain: env('MAILGUN_DOMAIN', 'test-value'),
      username: env('MAILGUN_USERNAME', 'test-value'),
      from: env('MAILGUN_FROM', 'test-value'),
    },

    mailjet: {
      key: env('MAILJET_API_KEY', 'test-value'),
      secret: env('MAILJET_API_SECRET', 'test-value'),
      from: env('MAILJET_FROM_EMAIL', 'test-value'),
    },

    mandrill: {
      key: env('MANDRILL_API_KEY', 'test-value'),
      from: env('MANDRILL_EMAIL', 'test-value'),
    },

    netcore: {
      key: env('NETCORE_API_KEY', 'test-value'),
      from: env('NETCORE_FROM', 'test-value'),
    },

    nodemailer: {
      from: env('NODEMAILER_FROM_EMAIL', 'test-value'),
      host: env('NODEMAILER_HOST', 'test-value'),
      user: env('NODEMAILER_USERNAME', 'test-value'),
      password: env('NODEMAILER_PASSWORD', 'test-value'),
      port: env('NODEMAILER_PORT', 40),
      secure: env('NODEMAILER_SECURE', true),
    },

    postmark: {
      key: env('POSTMARK_API_KEY', 'test-value'),
      from: env('POSTMARK_FROM', 'test-value'),
    },

    ses: {
      region: env('SES_REGION', 'test-value'),
      key: env('SES_ACCESS_KEY_ID', 'test-value'),
      secret: env('SES_SECRET_ACCESS_KEY', 'test-value'),
      from: env('SES_FROM', 'test-value'),
    },
  },

  sms: {
    twilio: {
      sid: env('TWILIO_ACCOUNT_SID', 'ACTEST'),
      authToken: env('TWILIO_AUTH_TOKEN', 'test-value'),
      from: env('TWILIO_FROM_NUMBER', 'test-value'),
      to: env('TWILIO_TO_NUMBER', 'test-value'),
    },

    nexmo: {
      key: env('VONAGE_API_KEY', 'test-value'),
      secret: env('VONAGE_API_SECRET', 'test-value'),
      from: env('VONAGE_FROM_NUMBER', 'test-value'),
    },

    gupshup: {
      user: env('GUPSHUP_USER_ID', 'test-value'),
      password: env('GUPSHUP_PASSWORD', 'test-value'),
    },

    plivo: {
      sid: env('PLIVO_ACCOUNT_ID', 'test-value'),
      authToken: env('PLIVO_AUTH_TOKEN', 'test-value'),
      from: env('PLIVO_FROM_NUMBER', 'test-value'),
    },

    sms77: {
      key: env('SMS77_API_KEY', 'test-value'),
      from: env('SMS77_FROM', 'test-value'),
    },

    sns: {
      region: env('SNS_REGION', 'test-value'),
      key: env('SNS_ACCESS_KEY_ID', 'test-value'),
      secret: env('SNS_SECRET_ACCESS_KEY', 'test-value'),
    },

    telnyx: {
      key: env('TELNYX_API_KEY', 'test-value'),
      messageProfileId: env('TELNYX_MESSAGE_PROFILE_ID', 'test-value'),
      from: env('TELNYX_FROM', 'test-value'),
    },

    termii: {
      key: env('TERMII_API_KEY', 'test-value'),
      from: env('TERMII_SENDER', 'test-value'),
    },
  },

  chat: {
    slack: {
      appId: env('SLACK_APPLICATION_ID', 'test-value'),
      clientId: env('SLACK_CLIENT_ID', 'test-value'),
      secret: env('SLACK_SECRET_KEY', 'test-value'),
    },

    msTeams: {
      appId: env('MICROSOFT_TEAMS_APPLICATION_ID', 'test-value'),
      clientId: env('MICROSOFT_TEAMS_CLIENT_ID', 'test-value'),
      secret: env('MICROSOFT_TEAMS_SECRET', 'test-value'),
    },

    // discord: {},
  },
})
