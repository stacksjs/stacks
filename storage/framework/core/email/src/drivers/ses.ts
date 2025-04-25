import type { EmailMessage, EmailResult } from '@stacksjs/types'
import type { RenderOptions } from '@vue-email/compiler'
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
      accessKeyId: config.services.ses?.credentials?.accessKeyId ?? '',
      secretAccessKey: config.services.ses?.credentials?.secretAccessKey ?? '',
    }

    this.client = new SES({
      region: config.services.ses?.region || 'us-east-1',
      credentials,
    })
  }

  public async send(message: EmailMessage, options?: RenderOptions): Promise<EmailResult> {
    try {
      this.validateMessage(message)

      // Only attempt to render template if one is provided
      let htmlContent: string | undefined
      if (message.template) {
        const templ = await template(message.template, options)
        if (templ && 'html' in templ) {
          htmlContent = templ.html
        }
      }

      const messageBody: any = {}

      // Add HTML content if available
      if (htmlContent) {
        messageBody.Html = {
          Charset: config.email.charset || 'UTF-8',
          Data: htmlContent,
        }
      }

      // Add text content if available
      if (message.text) {
        messageBody.Text = {
          Charset: config.email.charset || 'UTF-8',
          Data: message.text,
        }
      }

      // If no content was added, throw an error
      if (Object.keys(messageBody).length === 0) {
        throw new Error('Email must have either HTML or text content')
      }

      const params = {
        Source: message.from?.address || config.email.from?.address,

        Destination: {
          ToAddresses: this.formatAddresses(message.to),
          CcAddresses: this.formatAddresses(message.cc),
          BccAddresses: this.formatAddresses(message.bcc),
        },

        Message: {
          Body: messageBody,
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
