import type { EmailMessage, EmailResult } from '@stacksjs/types'
import type { TemplateOptions } from '../template'
import { config } from '@stacksjs/config'
import { SESClient } from '@stacksjs/ts-cloud'
import { template } from '../template'
import { BaseEmailDriver } from './base'

export class SESDriver extends BaseEmailDriver {
  public name = 'ses'
  private client: SESClient | null = null

  /**
   * Lazy SESClient construction. Per-service credentials configured under
   * `services.ses.credentials.{accessKeyId,secretAccessKey}` are forwarded
   * when set so a dedicated SES IAM user doesn't have to overload the
   * global `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` env vars used by
   * the rest of the AWS surface. Empty values fall through to the env →
   * `~/.aws/credentials` chain inside AWSClient.
   */
  private getClient(): SESClient {
    if (!this.client) {
      const sesConfig = config?.services?.ses as
        | {
          region?: string
          credentials?: { accessKeyId?: string, secretAccessKey?: string, sessionToken?: string }
        }
        | undefined
      const explicit = sesConfig?.credentials
      const hasExplicit = !!(explicit?.accessKeyId && explicit?.secretAccessKey)
      this.client = new SESClient(
        sesConfig?.region || 'us-east-1',
        hasExplicit
          ? {
              accessKeyId: explicit!.accessKeyId!,
              secretAccessKey: explicit!.secretAccessKey!,
              sessionToken: explicit!.sessionToken,
            }
          : undefined,
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
      return this.handleError(this.enrichSesError(error), message)
    }
  }

  /**
   * SES-specific quote-safe display-name formatting for the envelope From.
   * Mirrors the logic `BaseEmailDriver.formatAddresses` applies to recipient
   * lists. Without quoting, a display name containing `,`/`"`/`<`/`>` etc.
   * gets misparsed by SMTP relays (e.g. `Smith, John <j@x.com>` becomes
   * two envelope recipients) and SES will reject the message outright.
   */
  private formatSourceAddress(from: { address: string, name?: string }): string {
    if (!from.name) return from.address
    const needsQuoting = /[",()<>[\]:;@\\]/.test(from.name)
    const safeName = needsQuoting
      ? `"${from.name.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
      : from.name
    return `${safeName} <${from.address}>`
  }

  /**
   * Tag SES failures with their most common actionable cause. Without this,
   * a sandbox-mode account trying to send to an unverified recipient
   * surfaces a generic `MessageRejected` and gets misread as "auth broken"
   * — the real fix lives in the SES console (verify the identity, or
   * request production access).
   */
  private enrichSesError(error: unknown): Error {
    const err = error instanceof Error ? error : new Error(String(error))
    const text = `${err.message} ${(err as { name?: string }).name ?? ''}`.toLowerCase()
    const region = (config?.services?.ses as { region?: string } | undefined)?.region || 'us-east-1'

    // Sandbox / unverified identity
    if (text.includes('email address is not verified')
      || text.includes('not authorized to send')
      || (text.includes('messagerejected') && text.includes('verified'))) {
      err.message
        = `${err.message}\n\nSES sandbox restriction: the From and (in sandbox) every To address must be verified. `
          + `Verify identities in the SES console under "Verified identities" `
          + `(region: ${region}), or request production access to lift the recipient restriction.`
      return err
    }

    // Missing / invalid credentials
    if (text.includes('signaturedoesnotmatch')
      || text.includes('invalidclienttokenid')
      || text.includes('unable to locate credentials')
      || text.includes('the security token included in the request is invalid')) {
      err.message
        = `${err.message}\n\nSES authentication failed. Check AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY `
          + `(or services.ses.credentials), and confirm the IAM principal has \`ses:SendEmail\` `
          + `permission for the From identity.`
      return err
    }

    // Region / endpoint mismatch
    if (text.includes('could not be reached') || text.includes('econnrefused') || text.includes('enotfound')) {
      err.message
        = `${err.message}\n\nSES endpoint unreachable. The configured region (\`${region}\`) `
          + `must match the region where the From identity is verified.`
      return err
    }

    return err
  }
}

export default SESDriver
