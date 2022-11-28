import { env } from '@stacksjs/utils'
/**
 * ### Notification Options
 *
 * This configuration defines all of your notification options. Because Stacks is full-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 */

export const notification = {
    email: {
        sendgrid: {
            key: env('SENDGRID_API_KEY', '')
        },
        emailjs: {
            from: env('EMAILJS_FROM_EMAIL', ''),
            host: env('EMAILJS_HOST', ''),
            user: env('EMAILJS_USERNAME', ''),
            password: env('EMAILJS_PASSWORD', ''),
            port: env('EMAILJS_PORT', ''),
            secure: env('EMAILJS_SECURE', '') 
        },
        mailgun: {
            key: env('MAILGUN_API_KEY', ''),
            domain: env('MAILGUN_DOMAIN', ''),
            username: env('MAILGUN_USERNAME', '')
        },
        mailjet: {
            key: env('MAILJET_APIKEY', ''),
            secret: env('MAILJET_API_SECRET', ''),
            from: env('MAILJET_FROM_EMAIL', '')
        },
        mandrill: {
            key: env('MANDRILL_API_KEY', ''),
            from: env('MANDRILL_EMAIL', ''),
        },
        netcore: {
            key: env('NETCORE_API_KEY'),
        },
        nodemailer: {
            from: env('NODEMAILER_FROM_EMAIL', ''),
            host: env('NODEMAILER_HOST', ''),
            user: env('NODEMAILER_USERNAME', ''),
            password: env('NODEMAILER_PASSWORD', ''),
            port: env('NODEMAILER_PORT', ''),
            secure: env('NODEMAILER_SECURE', ''),
        },
        postmark: {
            key: env('POSTMARK_API_KEY', ''),
        },
        ses: {
            region: env('SES_REGION', ''),
            key: env('SES_ACCESS_KEY_ID', ''),
            secret: env('SES_SECRET_ACCESS_KEY', ''),
            from: env('SES_FROM', '')
        }
    },
    sms: {
        twilio: {
            sid: env('TWILIO_ACCOUNT_SID', ''),
            authToken: env('TWILIO_AUTH_TOKEN', ''),
            from: env('TWILIO_FROM_NUMBER', ''),
        },
        nexmo: {
            key: env('VONAGE_API_KEY', ''),
            secret: env('VONAGE_API_SECRET', ''),
            from: env('VONAGE_FROM_NUMBER', ''),
        },
        gupshup: {
            user: env('GUPSHUP_USER_ID', ''),
            password: env('GUPSHUP_PASSWORD', '')
        },
        plivo: {
            sid: env('PLIVO_ACCOUNT_ID', ''),
            authToken: env('PLIVO_AUTH_TOKEN', ''),
            from: env('PLIVO_FROM_NUMBER', '')
        },
        sms77: {
            key: env('SMS77_API_KEY', '') ,
            from: env('SMS77_FROM', '')
        },
        sns: {
            region: env('SNS_REGION', ''),
            key: env('SNS_ACCESS_KEY_ID', ''),
            secret: env('SNS_SECRET_ACCESS_KEY', '')
        },
        telnyx: {
            key: env('TELNYX_API_KEY', ''),
            messageProfileId:  env('TELNYX_MESSAGE_PROFILE_ID', ''),
            from: env('TELNYX_FROM', ''),
        },
        termii: {
            key: env('TERMII_API_KEY', ''),
            from: env('TERMII_SENDER', '')
        }
    },
    chat: {
        discord: {

        },
        slack: {
            appId: env('SLACK_APPLICATION_ID', ''),
            clientID: env('SLACK_CLIENT_ID', ''), 
            secret: env('SLACK_SECRET_KEY', '')
        }
    }
}