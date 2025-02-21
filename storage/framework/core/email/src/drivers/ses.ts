import type { EmailMessage, EmailResult, RenderOptions } from '@stacksjs/types'
import { SendEmailCommand, SES } from '@aws-sdk/client-ses'
import { config } from '@stacksjs/config'
import { template } from '../template'
import { BaseEmailDriver } from './base'

export class SESDriver extends BaseEmailDriver {
  public name = 'ses'
  private client: SES

  constructor() {
    super()

    const credentials = {
      accessKeyId: config.email.drivers?.ses?.credentials?.accessKeyId ?? '',
      secretAccessKey: config.email.drivers?.ses?.credentials?.secretAccessKey ?? '',
    }

    this.client = new SES({
      region: config.email.drivers?.ses?.region || 'us-east-1',
      credentials,
    })
  }

  public async send(message: EmailMessage, options?: RenderOptions): Promise<EmailResult> {
    try {
      this.validateMessage(message)
      const templ = await template(message.template, options)

      const params = {
        Source: message.from?.address || config.email.from?.address,

        Destination: {
          ToAddresses: this.formatAddresses(message.to),
          CcAddresses: this.formatAddresses(message.cc),
          BccAddresses: this.formatAddresses(message.bcc),
        },

        Message: {
          Body: {
            Html: {
              Charset: config.email.charset || 'UTF-8',
              Data: templ.html,
            },
          },
          Subject: {
            Charset: config.email.charset || 'UTF-8',
            Data: message.subject,
          },
        },
      }

      const response = await this.client.send(new SendEmailCommand(params))
      return this.handleSuccess(message, response.MessageId)
    }
    catch (error) {
      return this.handleError(error, message)
    }
  }
}

export default SESDriver
