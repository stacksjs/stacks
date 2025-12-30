import type { EmailAddress, EmailMessage, EmailResult } from '@stacksjs/types'
import type { RenderOptions } from '@vue-email/compiler'
import { Buffer } from 'node:buffer'
import { config } from '@stacksjs/config'
import { log } from '@stacksjs/logging'
import { template } from '../template'
import { BaseEmailDriver } from './base'

/**
 * SMTP Driver for local development
 * Works with HELO, Mailtrap Desktop, Mailhog, MailCatcher, etc.
 */
export class SMTPDriver extends BaseEmailDriver {
  public name = 'smtp'
  private smtpConfig: {
    host: string
    port: number
    username: string
    password: string
    encryption: 'tls' | 'ssl' | null
  } | null = null

  private getConfig() {
    if (!this.smtpConfig) {
      this.smtpConfig = {
        host: config.services.smtp?.host || '127.0.0.1',
        port: config.services.smtp?.port || 2525,
        username: config.services.smtp?.username || '',
        password: config.services.smtp?.password || '',
        encryption: config.services.smtp?.encryption || null,
      }
    }
    return this.smtpConfig
  }

  public async send(message: EmailMessage, options?: RenderOptions): Promise<EmailResult> {
    const smtpConfig = this.getConfig()
    const logContext = {
      provider: this.name,
      to: message.to,
      subject: message.subject,
      host: smtpConfig.host,
      port: smtpConfig.port,
    }

    log.info('Sending email via SMTP...', logContext)

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

      const fromAddress = message.from?.address || config.email.from?.address || ''
      const fromName = message.from?.name || config.email.from?.name || ''
      const toAddresses = this.formatAddresses(message.to)

      // Build email content
      const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`
      const emailContent = this.buildEmailContent({
        from: fromName ? `${fromName} <${fromAddress}>` : fromAddress,
        to: toAddresses.join(', '),
        cc: message.cc ? this.formatAddresses(message.cc).join(', ') : undefined,
        subject: message.subject,
        text: message.text,
        html: finalHtml,
        boundary,
      })

      // Send via SMTP
      const messageId = await this.sendViaSMTP(smtpConfig, fromAddress, toAddresses, emailContent)

      return this.handleSuccess(message, messageId)
    }
    catch (error) {
      return this.handleError(error, message)
    }
  }

  private buildEmailContent(options: {
    from: string
    to: string
    cc?: string
    subject: string
    text?: string
    html?: string
    boundary: string
  }): string {
    const { from, to, cc, subject, text, html, boundary } = options
    const lines: string[] = []

    // Headers
    lines.push(`From: ${from}`)
    lines.push(`To: ${to}`)
    if (cc)
      lines.push(`Cc: ${cc}`)
    lines.push(`Subject: ${subject}`)
    lines.push(`MIME-Version: 1.0`)
    lines.push(`Date: ${new Date().toUTCString()}`)
    lines.push(`Message-ID: <${Date.now()}.${Math.random().toString(36).substring(2)}@${config.email.domain || 'localhost'}>`)

    if (html && text) {
      // Multipart message with both HTML and text
      lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`)
      lines.push('')
      lines.push(`--${boundary}`)
      lines.push('Content-Type: text/plain; charset=UTF-8')
      lines.push('Content-Transfer-Encoding: 7bit')
      lines.push('')
      lines.push(text)
      lines.push('')
      lines.push(`--${boundary}`)
      lines.push('Content-Type: text/html; charset=UTF-8')
      lines.push('Content-Transfer-Encoding: 7bit')
      lines.push('')
      lines.push(html)
      lines.push('')
      lines.push(`--${boundary}--`)
    }
    else if (html) {
      lines.push('Content-Type: text/html; charset=UTF-8')
      lines.push('Content-Transfer-Encoding: 7bit')
      lines.push('')
      lines.push(html)
    }
    else if (text) {
      lines.push('Content-Type: text/plain; charset=UTF-8')
      lines.push('Content-Transfer-Encoding: 7bit')
      lines.push('')
      lines.push(text)
    }

    return lines.join('\r\n')
  }

  private async sendViaSMTP(
    smtpConfig: { host: string, port: number, username: string, password: string, encryption: 'tls' | 'ssl' | null },
    from: string,
    to: string[],
    content: string,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const socket = Bun.connect({
        hostname: smtpConfig.host,
        port: smtpConfig.port,
        socket: {
          data: (socket, data) => {
            const response = data.toString()
            log.debug(`[SMTP] Server: ${response.trim()}`)
          },
          open: async (socket) => {
            log.debug(`[SMTP] Connected to ${smtpConfig.host}:${smtpConfig.port}`)
          },
          close: () => {
            log.debug('[SMTP] Connection closed')
          },
          error: (socket, error) => {
            reject(error)
          },
        },
      })

      socket.then(async (sock) => {
        const send = (command: string): Promise<string> => {
          return new Promise((res) => {
            log.debug(`[SMTP] Client: ${command.trim()}`)
            sock.write(command + '\r\n')
            // Small delay to wait for response
            setTimeout(() => res(''), 100)
          })
        }

        const waitForResponse = (): Promise<void> => {
          return new Promise(res => setTimeout(res, 200))
        }

        try {
          await waitForResponse() // Wait for greeting

          await send(`EHLO ${config.email.domain || 'localhost'}`)
          await waitForResponse()

          // Auth if credentials provided
          if (smtpConfig.username && smtpConfig.password) {
            await send('AUTH LOGIN')
            await waitForResponse()
            await send(Buffer.from(smtpConfig.username).toString('base64'))
            await waitForResponse()
            await send(Buffer.from(smtpConfig.password).toString('base64'))
            await waitForResponse()
          }

          await send(`MAIL FROM:<${from}>`)
          await waitForResponse()

          for (const recipient of to) {
            await send(`RCPT TO:<${recipient}>`)
            await waitForResponse()
          }

          await send('DATA')
          await waitForResponse()

          await send(content)
          await send('.')
          await waitForResponse()

          await send('QUIT')
          sock.end()

          const messageId = `${Date.now()}.${Math.random().toString(36).substring(2)}@${smtpConfig.host}`
          resolve(messageId)
        }
        catch (error) {
          sock.end()
          reject(error)
        }
      }).catch(reject)
    })
  }

  private formatAddresses(addresses: string | string[] | EmailAddress[] | undefined): string[] {
    if (!addresses)
      return []

    if (typeof addresses === 'string')
      return [addresses]

    return addresses.map((addr) => {
      if (typeof addr === 'string')
        return addr
      return addr.address
    })
  }
}

export default SMTPDriver
