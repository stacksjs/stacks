import type { EmailMessage, EmailResult, RenderOptions, SESConfig } from '@stacksjs/types'
import { SendEmailCommand, SES } from '@aws-sdk/client-ses'
import { log } from '@stacksjs/logging'
import { BaseEmailDriver } from '../base'
import { template } from '../template'

export class SESDriver extends BaseEmailDriver {
  public name = 'ses'
  private client: SES

  constructor(config: SESConfig) {
    super(config)
    this.client = new SES({
      region: config.region,
      credentials: config.credentials,
    })
  }

  public async send(message: EmailMessage, options?: RenderOptions): Promise<EmailResult> {
    const logContext = {
      provider: this.name,
      to: message.to,
      subject: message.subject,
      template: message.template,
    }

    log.info('Sending email...', logContext)

    try {
      this.validateMessage(message)
      const templ = await template(message.template, options)

      const params = {
        Source: message.from.name
          ? `${message.from.name} <${message.from.address}>`
          : message.from.address,

        Destination: {
          ToAddresses: this.formatAddresses(message.to),
          CcAddresses: this.formatAddresses(message.cc),
          BccAddresses: this.formatAddresses(message.bcc),
        },

        Message: {
          Body: {
            Html: {
              Charset: 'UTF-8',
              Data: templ.html,
            },
            ...(message.text && {
              Text: {
                Charset: 'UTF-8',
                Data: message.text,
              },
            }),
          },
          Subject: {
            Charset: 'UTF-8',
            Data: message.subject,
          },
        },
      }

      const response = await this.sendWithRetry(params)
      return this.handleSuccess(message, response.MessageId)
    }
    catch (error) {
      return this.handleError(error, message)
    }
  }

  /**
   * SES-specific retry logic
   */
  private async sendWithRetry(params: any, attempt = 1): Promise<any> {
    try {
      const command = new SendEmailCommand(params)
      const response = await this.client.send(command)
      log.info(`[${this.name}] Email sent successfully`, { attempt })
      return response
    }
    catch (error) {
      if (attempt < this.config.maxRetries) {
        log.warn(`[${this.name}] Email send failed, retrying (${attempt}/${this.config.maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, this.config.retryTimeout))
        return this.sendWithRetry(params, attempt + 1)
      }
      throw error
    }
  }
}
