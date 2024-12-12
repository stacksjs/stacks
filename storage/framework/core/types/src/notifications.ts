export interface NotificationOptions {
  default: 'email' | 'sms' | 'chat' | string

  email: {
    default:
      | 'emailjs'
      | 'mailgun'
      | 'mailjet'
      | 'mandrill'
      | 'netcore'
      | 'nodemailer'
      | 'postmark'
      | 'sendgrid'
      | 'ses'
      | string

    from: {
      name: string
      address: string
    }

    drivers: {
      smtp: {
        host: string
        port: number
        secure: boolean
        auth: {
          user: string
          pass: string
        }
      }

      sendgrid: {
        key: string
        senderName: string
      }

      emailjs: {
        host: string
        user: string
        password: string
        port: number
        secure: boolean
      }

      mailgun: {
        key: string
        domain: string
        username: string
      }

      mailjet: {
        key: string
        secret: string
      }

      mandrill: {
        key: string
      }

      netcore: {
        key: string
      }

      nodemailer: {
        host: string
        user: string
        password: string
        port: number
        secure: boolean
      }

      postmark: {
        key: string
      }

      ses: {
        region: string
        key: string
        secret: string
      }
    }
  }

  sms: {
    default: 'twilio' | 'nexmo' | 'gupshup' | 'plivo' | 'sms77' | 'sns' | 'telnyx' | 'termii' | string
    from: string

    drivers: {
      twilio: {
        sid: string
        authToken: string
      }

      nexmo: {
        key: string
        secret: string
      }

      gupshup: {
        user: string
        password: string
      }

      plivo: {
        sid: string
        authToken: string
      }

      sms77: {
        key: string
      }

      sns: {
        region: string
        key: string
        secret: string
      }

      telnyx: {
        key: string
        messageProfileId: string
      }

      termii: {
        key: string
      }
    }
  }

  chat: {
    default: 'slack' | 'msTeams' | 'discord' | string
    from: string

    drivers: {
      slack?: {
        appId: string
        clientId: string
        secret: string
      }

      msTeams?: {
        appId: string
        clientId: string
        secret: string
      }

      // discord?: {}
    }
  }
}

export type NotificationConfig = Partial<NotificationOptions>
