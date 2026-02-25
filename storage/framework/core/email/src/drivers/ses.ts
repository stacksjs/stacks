import type { EmailMessage, EmailResult } from '@stacksjs/types'
import { SESClient } from '@stacksjs/ts-cloud'
import { config } from '@stacksjs/config'
import type { TemplateOptions } from '../template'
import { template } from '../template'
import { BaseEmailDriver } from './base'

export class SESDriver extends BaseEmailDriver {
  public name = 'ses'
  private client: SESClient | null = null

  private getClient(): SESClient {
    if (!this.client) {
      this.client = new SESClient(
        config?.services?.ses?.region || 'us-east-1',
      )
    }

    return this.client
  }

  public async send(message: EmailMessage, options?: TemplateOptions): Promise<EmailResult> {
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

      // Use template HTML if available, otherwise use direct HTML from message
      const finalHtml = htmlContent || message.html

      const body: {
        Text?: { Data: string, Charset?: string }
        Html?: { Data: string, Charset?: string }
      } = {}

      // Add HTML content if available
      if (finalHtml) {
        body.Html = {
          Charset: config.email.charset || 'UTF-8',
          Data: finalHtml,
        }
      }

      // Add text content if available
      if (message.text) {
        body.Text = {
          Charset: config.email.charset || 'UTF-8',
          Data: message.text,
        }
      }

      // If no content was added, throw an error
      if (Object.keys(body).length === 0) {
        throw new Error('Email must have either HTML or text content')
      }

      const result = await this.getClient().sendEmail({
        FromEmailAddress: this.formatSourceAddress({
          address: message.from?.address || config.email.from?.address || '',
          name: message.from?.name || config.email.from?.name,
        }),

        Destination: {
          ToAddresses: this.formatAddresses(message.to),
          CcAddresses: this.formatAddresses(message.cc),
          BccAddresses: this.formatAddresses(message.bcc),
        },

        Content: {
          Simple: {
            Subject: {
              Charset: config.email.charset || 'UTF-8',
              Data: message.subject,
            },
            Body: body,
          },
        },
      })

      return this.handleSuccess(message, result.MessageId)
    }
    catch (error) {
      return this.handleError(error, message)
    }
  }

  private formatSourceAddress(from: { address: string, name?: string }): string {
    return from.name ? `${from.name} <${from.address}>` : from.address
  }

  protected formatAddresses(addresses: string | string[] | { address: string, name?: string }[] | undefined): string[] {
    if (!addresses)
      return []

    if (typeof addresses === 'string')
      return [addresses]

    return addresses.map(addr =>
      typeof addr === 'string' ? addr : addr.address,
    )
  }
}

export default SESDriver
