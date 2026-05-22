import type { EmailMessage, EmailResult } from '@stacksjs/types'
import type { TemplateOptions } from '../template'
import { config } from '@stacksjs/config'
import { SESClient } from '@stacksjs/ts-cloud'
import { template } from '../template'
import { buildMimeMessage } from '../mime'
import { filterStringHeaders } from '../validation'
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

      if (!finalHtml && !message.text) {
        throw new Error('Email must have either HTML or text content')
      }

      const fromAddress = this.formatSourceAddress({
        address: message.from?.address || config.email.from?.address || '',
        name: message.from?.name || config.email.from?.name,
      })
      const toAddresses = this.formatAddresses(message.to)
      const ccAddresses = this.formatAddresses(message.cc)
      const bccAddresses = this.formatAddresses(message.bcc)
      const replyToAddresses = message.replyTo ? this.formatAddressList(message.replyTo) : []
      const customHeaders = filterStringHeaders(message.headers)
      const hasAttachments = !!(message.attachments && message.attachments.length > 0)
      const hasCustomHeaders = !!customHeaders

      // Attachments + custom headers are unsupported by SES's `Simple`
      // content shape — we have to fall back to `SendRawEmail` (RFC
      // 5322 wire bytes). Without this fallback, attachments and
      // List-Unsubscribe-style headers silently no-op'd on the SES
      // driver. See stacksjs/stacks#1871 M-2 / M-5.
      if (hasAttachments || hasCustomHeaders) {
        const raw = buildMimeMessage({
          from: fromAddress,
          to: toAddresses.join(', '),
          cc: ccAddresses.length > 0 ? ccAddresses.join(', ') : undefined,
          replyTo: replyToAddresses.length > 0 ? replyToAddresses.join(', ') : undefined,
          customHeaders,
          subject: message.subject,
          text: message.text,
          html: finalHtml,
          attachments: message.attachments,
          messageIdDomain: config.email.domain,
        })
        // SES's SendRawEmail takes the entire RFC 5322 envelope. The
        // BCC list is NOT in the wire bytes — SES handles delivery to
        // bcc'd recipients via the `Destinations` argument.
        const result = await this.getClient().sendRawEmail({
          source: fromAddress,
          destinations: [...toAddresses, ...ccAddresses, ...bccAddresses],
          rawMessage: raw,
        })
        return this.handleSuccess(message, result.MessageId)
      }

      // Fast path — attachments-free, no custom headers — use the
      // simple `SendEmail` shape so SES handles encoding for us.
      const body: {
        Text?: { Data: string, Charset?: string }
        Html?: { Data: string, Charset?: string }
      } = {}
      if (finalHtml) {
        body.Html = { Charset: config.email.charset || 'UTF-8', Data: finalHtml }
      }
      if (message.text) {
        body.Text = { Charset: config.email.charset || 'UTF-8', Data: message.text }
      }

      const result = await this.getClient().sendEmail({
        FromEmailAddress: fromAddress,
        Destination: {
          ToAddresses: toAddresses,
          CcAddresses: ccAddresses,
          BccAddresses: bccAddresses,
        },
        // Reply-To addresses (stacksjs/stacks#1871 M-4). SES accepts an
        // array of formatted addresses at this slot. Omit when the
        // caller didn't set replyTo to avoid sending an empty array.
        ...(replyToAddresses.length > 0
          ? { ReplyToAddresses: replyToAddresses }
          : {}),
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
