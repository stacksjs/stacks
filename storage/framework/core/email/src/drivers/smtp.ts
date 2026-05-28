import type { EmailAddress, EmailMessage, EmailResult } from '@stacksjs/types'
import { Buffer } from 'node:buffer'
import process from 'node:process'
import * as tls from 'node:tls'
import * as net from 'node:net'
import { config } from '@stacksjs/config'
import { log } from '@stacksjs/logging'
import type { TemplateOptions } from '../template'
import { template } from '../template'
import { buildMimeMessage } from '../mime'
import { ENVELOPE_ADDRESS, filterStringHeaders } from '../validation'
import { BaseEmailDriver } from './base'

// `encodeRfc2047IfNeeded` moved to `../mime` and is shared with the SES
// `SendRawEmail` path (stacksjs/stacks#1871 M-2 / M-3).

/**
 * SMTP envelope-address validator.
 *
 * SMTP commands are CRLF-terminated, so any user-controlled address
 * containing `\r` / `\n` lets an attacker inject a fresh command into
 * the conversation (the classic "BCC injection" vector — slip
 * `victim@example.com\r\nRCPT TO:<attacker@evil.com>` into a `to`
 * field and the server happily accepts a hidden recipient). The
 * regex below rejects every shape that isn't a plain `local@domain`
 * with no whitespace, control chars, angle brackets, quotes, or
 * backslashes — which is intentionally tighter than full RFC 5321
 * because the broader form (display names, comments, source routes)
 * has no business reaching this transport.
 */
// `ENVELOPE_ADDRESS` regex now lives in `../validation` (single source
// of truth across the base driver, SMTP, and any future driver that
// needs an envelope-shape check). See stacksjs/stacks#1871 M-6.
function assertEnvelopeAddress(addr: string, role: string): void {
  if (typeof addr !== 'string' || !ENVELOPE_ADDRESS.test(addr)) {
    throw new Error(`[smtp] Refusing to send: ${role} envelope address contains forbidden characters or is malformed: ${JSON.stringify(addr)}`)
  }
}

/**
 * SMTP Driver for email sending
 * Works with any SMTP server: Mailtrap, Mailgun, SendGrid, SES, etc.
 * Supports STARTTLS (port 587) and direct TLS (port 465)
 */
export class SMTPDriver extends BaseEmailDriver {
  private static readonly SMTP_TIMEOUT = 30_000 // 30 seconds

  public name = 'smtp'

  /**
   * Resolve SMTP settings fresh on every call (stacksjs/stacks#1925).
   *
   * The previous implementation cached the resolved config on the
   * instance after the first read. If that first `mail.send()` landed
   * inside the boot window — before `@stacksjs/config`'s async
   * `overridesReady` finished importing `~/config/services` — then
   * `config.services.smtp` read as `undefined`, the fallback snapped
   * `127.0.0.1:587` into the cache, and *every* subsequent send hit
   * port 587 forever (ECONNREFUSED against a Mailpit on 2525, with no
   * way to recover short of a restart).
   *
   * A property read is cheap next to a multi-RTT SMTP round-trip, so
   * there was never a reason to cache. Reading every call also makes
   * the driver correct under hot-reload / per-test config swaps.
   *
   * As belt-and-suspenders, fall back to `process.env.MAIL_*` so a
   * correctly-populated `.env` works even if the config layer hasn't
   * surfaced the override yet.
   */
  private getConfig() {
    const smtp = config.services?.smtp
    const env = process.env

    const host = smtp?.host || env.MAIL_HOST || '127.0.0.1'
    const port = smtp?.port || (env.MAIL_PORT ? Number(env.MAIL_PORT) : undefined) || 587
    const username = smtp?.username || env.MAIL_USERNAME || ''
    const password = smtp?.password || env.MAIL_PASSWORD || ''
    const rawEncryption = smtp?.encryption ?? env.MAIL_ENCRYPTION ?? null

    return {
      host,
      port,
      username,
      password,
      // Map 'tls' to 'starttls' for port 587 (STARTTLS), 'ssl' for port 465 (implicit TLS)
      encryption: (rawEncryption === 'tls' ? 'starttls' : rawEncryption || null) as 'tls' | 'ssl' | 'starttls' | null,
    }
  }

  public async send(message: EmailMessage, options?: TemplateOptions): Promise<EmailResult> {
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

      // Build email content via the shared MIME helper. Reply-To,
      // custom headers, and attachments all flow through the same code
      // path used by the SES `SendRawEmail` branch — see
      // stacksjs/stacks#1871 M-2 / M-3 / M-4 / M-5.
      const replyToAddresses = this.formatAddressList(message.replyTo)
      const emailContent = buildMimeMessage({
        from: fromName ? `${fromName} <${fromAddress}>` : fromAddress,
        to: toAddresses.join(', '),
        cc: message.cc ? this.formatAddresses(message.cc).join(', ') : undefined,
        replyTo: replyToAddresses.length > 0 ? replyToAddresses.join(', ') : undefined,
        customHeaders: filterStringHeaders(message.headers),
        subject: message.subject,
        text: message.text,
        html: finalHtml,
        attachments: message.attachments,
        messageIdDomain: config.email.domain,
      })

      // Send via SMTP
      const messageId = await this.sendViaSMTP(smtpConfig, fromAddress, toAddresses, emailContent)

      return this.handleSuccess(message, messageId)
    }
    catch (error) {
      return this.handleError(error, message)
    }
  }

  // MIME envelope building lives in `../mime` (shared with the SES
  // SendRawEmail path) since stacksjs/stacks#1871 M-2 / M-3.

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
      resolve = (value: string | PromiseLike<string>) => { clearTimeout(timeout); originalResolve(value) }
      reject = (reason?: unknown) => { clearTimeout(timeout); originalReject(reason) }

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
              tlsSocket.on('error', (err: any) => {
                log.error('[SMTP] TLS socket error:', err)
                rej(err)
              })
              tlsSocket.on('data', handleData)
              tlsSocket.on('close', (hadError: any) => {
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

          // SMTP command injection guard — see assertEnvelopeAddress below.
          assertEnvelopeAddress(from, 'MAIL FROM')
          for (const recipient of to) assertEnvelopeAddress(recipient, 'RCPT TO')

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
