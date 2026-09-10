/** A channel a notification can be delivered on. */
export type NotificationChannelName = 'email' | 'sms' | 'chat' | 'database' | 'push' | 'broadcast'

export interface NotificationOptions {
  default: 'email' | 'sms' | 'chat' | string

  /**
   * Delivery tracking: every send recorded to `notification_deliveries`, which
   * is what the dashboard's notification pages read (stacksjs/stacks#328).
   *
   * On by default, because the value is in not having to remember to turn it
   * on before the send you needed to explain. `channels` narrows it - a
   * high-volume push channel can be excluded without losing the email trail.
   */
  tracking: {
    enabled: boolean
    /** Record only these channels. Omitted or empty means all of them. */
    channels?: NotificationChannelName[]
    /**
     * Record the rendered body.
     *
     * Off for a project whose notifications carry personal data it would
     * rather not keep a second copy of; the row still records that the
     * message was sent, to whom, and whether it succeeded.
     */
    body: boolean
  }

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
