import type { EmailAddress, EmailMessage, EmailResult } from '@stacksjs/types'
import type { RenderOptions } from '@vue-email/compiler'
import { Buffer } from 'node:buffer'
import * as tls from 'node:tls'
import * as net from 'node:net'
import { config } from '@stacksjs/config'
import { log } from '@stacksjs/logging'
import { template } from '../template'
import { BaseEmailDriver } from './base'

/**
 * SMTP Driver for email sending
 * Works with any SMTP server: Mailtrap, Mailgun, SendGrid, SES, etc.
 * Supports STARTTLS (port 587) and direct TLS (port 465)
 */
export class SMTPDriver extends BaseEmailDriver {
  private static readonly SMTP_TIMEOUT = 30_000 // 30 seconds

  public name = 'smtp'
  private smtpConfig: {
    host: string
    port: number
    username: string
    password: string
    encryption: 'tls' | 'ssl' | 'starttls' | null
  } | null = null

  private getConfig() {
    if (!this.smtpConfig) {
      const encryption = config.services.smtp?.encryption
      this.smtpConfig = {
        host: config.services.smtp?.host || '127.0.0.1',
        port: config.services.smtp?.port || 587,
        username: config.services.smtp?.username || '',
        password: config.services.smtp?.password || '',
        // Map 'tls' to 'starttls' for port 587 (STARTTLS), 'ssl' for port 465 (implicit TLS)
        encryption: encryption === 'tls' ? 'starttls' : encryption || null,
      }
    }
    return this.smtpConfig
  }

  public async send(message: EmailMessage, options?: RenderOptions): Promise<EmailResult> {
    const smtpConfig = this.getConfig()

    // Validate SMTP config
    if (!smtpConfig.host || smtpConfig.host === '') {
      throw new Error('[SMTP] Host is not configured. Set MAIL_HOST in your .env file.')
    }

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
        const templ = await template(message.template, options as any)
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
    smtpConfig: { host: string, port: number, username: string, password: string, encryption: 'tls' | 'ssl' | 'starttls' | null },
    from: string,
    to: string[],
    content: string,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`SMTP connection timed out after ${SMTPDriver.SMTP_TIMEOUT}ms`))
      }, SMTPDriver.SMTP_TIMEOUT)

      const originalResolve = resolve
      const originalReject = reject
      resolve = (value: string) => { clearTimeout(timeout); originalResolve(value) }
      reject = (reason?: any) => { clearTimeout(timeout); originalReject(reason) }

      let socket: net.Socket | tls.TLSSocket
      let buffer = ''
      const _currentCommand = ''
      const commandQueue: Array<{ cmd: string, resolve: (response: string) => void, reject: (error: Error) => void }> = []
      const _isProcessing = false

      const processResponse = (response: string) => {
        log.debug(`[SMTP] Server: ${response.trim()}`)

        // Check for error responses
        const code = parseInt(response.substring(0, 3), 10)
        if (code >= 400) {
          const error = new Error(`SMTP Error: ${response.trim()}`)
          if (commandQueue.length > 0) {
            const current = commandQueue.shift()
            current?.reject(error)
          }
          return
        }

        if (commandQueue.length > 0) {
          const current = commandQueue.shift()
          current?.resolve(response)
        }
      }

      const sendCommand = (cmd: string): Promise<string> => {
        return new Promise((res, rej) => {
          commandQueue.push({ cmd, resolve: res, reject: rej })
          log.debug(`[SMTP] Client: ${cmd}`)
          socket.write(`${cmd}\r\n`)
        })
      }

      const handleData = (data: Buffer) => {
        buffer += data.toString()

        // SMTP responses end with \r\n, multi-line responses have - after code
        const lines = buffer.split('\r\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.length >= 3) {
            // Check if this is the last line of a multi-line response
            const isLastLine = line.length === 3 || line[3] === ' '
            if (isLastLine) {
              processResponse(line)
            }
          }
        }
      }

      const runSmtpSession = async () => {
        try {
          // Wait for greeting
          await new Promise<string>((res, rej) => {
            commandQueue.push({ cmd: 'GREETING', resolve: res, reject: rej })
          })

          // Send EHLO
          const _ehloResponse = await sendCommand(`EHLO ${config.email.domain || 'localhost'}`)

          // Handle STARTTLS if needed
          if (smtpConfig.encryption === 'starttls' && !(socket instanceof tls.TLSSocket)) {
            await sendCommand('STARTTLS')

            // Remove old data handler from plain socket before TLS upgrade
            const plainSocket = socket as net.Socket
            plainSocket.removeAllListeners('data')

            // Upgrade to TLS
            socket = await new Promise<tls.TLSSocket>((res, rej) => {
              const tlsSocket = tls.connect({
                socket: plainSocket,
                host: smtpConfig.host,
                servername: smtpConfig.host,
              }, () => {
                log.debug('[SMTP] TLS connection established')
                res(tlsSocket)
              })
              tlsSocket.on('error', (err) => {
                log.error('[SMTP] TLS socket error:', err)
                rej(err)
              })
              tlsSocket.on('data', handleData)
              tlsSocket.on('close', (hadError) => {
                log.debug(`[SMTP] TLS socket closed (hadError: ${hadError})`)
                while (commandQueue.length > 0) {
                  const pending = commandQueue.shift()
                  pending?.reject(new Error('TLS connection closed unexpectedly'))
                }
              })
            })

            // Re-send EHLO after STARTTLS
            await sendCommand(`EHLO ${config.email.domain || 'localhost'}`)
          }

          // Authenticate if credentials provided
          if (smtpConfig.username && smtpConfig.password) {
            await sendCommand('AUTH LOGIN')
            await sendCommand(Buffer.from(smtpConfig.username).toString('base64'))
            await sendCommand(Buffer.from(smtpConfig.password).toString('base64'))
          }

          // Send email
          await sendCommand(`MAIL FROM:<${from}>`)

          for (const recipient of to) {
            await sendCommand(`RCPT TO:<${recipient}>`)
          }

          await sendCommand('DATA')

          // Send email content (no response expected until final .)
          socket.write(`${content}\r\n.\r\n`)
          await new Promise<string>((res, rej) => {
            commandQueue.push({ cmd: 'DATA_END', resolve: res, reject: rej })
          })

          await sendCommand('QUIT')
          socket.end()

          const messageId = `${Date.now()}.${Math.random().toString(36).substring(2)}@${smtpConfig.host}`
          resolve(messageId)
        }
        catch (error) {
          socket.end()
          reject(error)
        }
      }

      // Create connection based on encryption type
      if (smtpConfig.encryption === 'ssl') {
        // Direct TLS connection (port 465)
        socket = tls.connect({
          host: smtpConfig.host,
          port: smtpConfig.port,
          servername: smtpConfig.host,
        }, () => {
          log.debug(`[SMTP] TLS connected to ${smtpConfig.host}:${smtpConfig.port}`)
          runSmtpSession()
        })
      }
      else {
        // Plain connection (will upgrade to TLS with STARTTLS if needed)
        socket = net.connect({
          host: smtpConfig.host,
          port: smtpConfig.port,
        }, () => {
          log.debug(`[SMTP] Connected to ${smtpConfig.host}:${smtpConfig.port}`)
          runSmtpSession()
        })
      }

      socket.on('data', handleData)
      socket.setTimeout(SMTPDriver.SMTP_TIMEOUT)
      socket.on('timeout', () => {
        socket.destroy(new Error(`SMTP socket timed out after ${SMTPDriver.SMTP_TIMEOUT}ms`))
      })
      socket.on('error', (error) => {
        log.error(`[SMTP] Connection error to ${smtpConfig.host}:${smtpConfig.port}:`, error)
        reject(error)
      })
      socket.on('close', (hadError) => {
        log.debug(`[SMTP] Connection closed (hadError: ${hadError})`)
        // Reject any pending commands
        while (commandQueue.length > 0) {
          const pending = commandQueue.shift()
          pending?.reject(new Error('Connection closed unexpectedly'))
        }
      })
    })
  }

  protected formatAddresses(addresses: string | string[] | EmailAddress[] | undefined): string[] {
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
