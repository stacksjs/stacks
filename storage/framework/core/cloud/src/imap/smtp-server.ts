/**
 * SMTP Relay Server
 * Provides SMTP access with user-friendly credentials that relays to AWS SES
 *
 * This allows email clients like Mail.app to send emails using:
 * - Server: mail.yourdomain.com
 * - Username: chris (or chris@yourdomain.com)
 * - Password: your-password
 *
 * Instead of the unfriendly AWS SES SMTP credentials.
 */

import * as net from 'node:net'
import * as tls from 'node:tls'
import * as fs from 'node:fs'
import * as crypto from 'node:crypto'
import { SESClient } from './ses'
import { S3Client } from './s3'

export interface SmtpServerConfig {
  port?: number
  tlsPort?: number
  host?: string
  region?: string
  domain: string
  users: Record<string, { password: string; email: string }>
  tls?: {
    key: string
    cert: string
  }
  // Optional: S3 bucket for storing sent emails
  sentBucket?: string
  sentPrefix?: string
}

interface SmtpSession {
  id: string
  socket: net.Socket
  secure: boolean
  state: 'greeting' | 'ready' | 'mail' | 'rcpt' | 'data' | 'quit'
  authenticated: boolean
  username?: string
  email?: string
  mailFrom?: string
  rcptTo: string[]
  dataBuffer: string
  tlsUpgraded: boolean
}

/**
 * SMTP Server that relays emails through AWS SES
 */
export class SmtpServer {
  private config: SmtpServerConfig
  private ses: SESClient
  private s3?: S3Client
  private server?: net.Server
  private tlsServer?: tls.Server
  private sessions: Map<string, SmtpSession> = new Map()

  constructor(config: SmtpServerConfig) {
    this.config = {
      port: 587, // Submission port (STARTTLS)
      tlsPort: 465, // Implicit TLS
      host: '0.0.0.0',
      ...config,
    }
    this.ses = new SESClient(config.region || 'us-east-1')
    if (config.sentBucket) {
      this.s3 = new S3Client(config.region || 'us-east-1')
    }
  }

  /**
   * Start the SMTP server
   */
  async start(): Promise<void> {
    // Start STARTTLS SMTP server on port 587
    this.server = net.createServer((socket) => {
      this.handleConnection(socket, false)
    })

    this.server.listen(this.config.port, this.config.host, () => {
      console.log(`SMTP server listening on ${this.config.host}:${this.config.port} (STARTTLS)`)
    })

    // Start implicit TLS SMTP server on port 465 if certificates provided
    if (this.config.tls?.key && this.config.tls?.cert) {
      const tlsOptions: tls.TlsOptions = {
        key: fs.readFileSync(this.config.tls.key),
        cert: fs.readFileSync(this.config.tls.cert),
      }

      this.tlsServer = tls.createServer(tlsOptions, (socket) => {
        this.handleConnection(socket, true)
      })

      this.tlsServer.listen(this.config.tlsPort, this.config.host, () => {
        console.log(`SMTP server listening on ${this.config.host}:${this.config.tlsPort} (TLS)`)
      })
    }
  }

  /**
   * Stop the SMTP server
   */
  async stop(): Promise<void> {
    if (this.server) {
      this.server.close()
    }
    if (this.tlsServer) {
      this.tlsServer.close()
    }
    for (const session of this.sessions.values()) {
      session.socket.destroy()
    }
    this.sessions.clear()
  }

  /**
   * Handle a new connection
   */
  private handleConnection(socket: net.Socket, secure: boolean): void {
    const sessionId = crypto.randomUUID()
    const session: SmtpSession = {
      id: sessionId,
      socket,
      secure,
      state: 'greeting',
      authenticated: false,
      rcptTo: [],
      dataBuffer: '',
      tlsUpgraded: secure,
    }

    this.sessions.set(sessionId, session)
    console.log(`SMTP connection from ${socket.remoteAddress} (session: ${sessionId.slice(0, 8)})`)

    // Send greeting
    this.send(session, `220 ${this.config.domain} ESMTP Mail Server`)
    session.state = 'ready'

    let buffer = ''

    socket.on('data', async (data) => {
      buffer += data.toString()

      // Process complete lines
      let lineEnd: number
      while ((lineEnd = buffer.indexOf('\r\n')) !== -1) {
        const line = buffer.slice(0, lineEnd)
        buffer = buffer.slice(lineEnd + 2)

        if (session.state === 'data') {
          await this.handleDataLine(session, line)
        } else {
          await this.handleCommand(session, line)
        }
      }
    })

    socket.on('close', () => {
      console.log(`SMTP session ${sessionId.slice(0, 8)} closed`)
      this.sessions.delete(sessionId)
    })

    socket.on('error', (err) => {
      console.error(`SMTP session ${sessionId.slice(0, 8)} error:`, err.message)
      this.sessions.delete(sessionId)
    })
  }

  /**
   * Send a response to the client
   */
  private send(session: SmtpSession, message: string): void {
    if (!session.socket.destroyed) {
      session.socket.write(message + '\r\n')
    }
  }

  /**
   * Handle an SMTP command
   */
  private async handleCommand(session: SmtpSession, line: string): Promise<void> {
    const command = line.split(' ')[0].toUpperCase()
    const args = line.slice(command.length).trim()

    console.log(`SMTP CMD [${session.username || 'anon'}]: ${command} ${args.includes('AUTH') ? '***' : args}`)

    switch (command) {
      case 'EHLO':
      case 'HELO':
        await this.handleEhlo(session, args)
        break

      case 'STARTTLS':
        await this.handleStartTls(session)
        break

      case 'AUTH':
        await this.handleAuth(session, args)
        break

      case 'MAIL':
        await this.handleMailFrom(session, args)
        break

      case 'RCPT':
        await this.handleRcptTo(session, args)
        break

      case 'DATA':
        await this.handleData(session)
        break

      case 'RSET':
        this.resetSession(session)
        this.send(session, '250 OK')
        break

      case 'NOOP':
        this.send(session, '250 OK')
        break

      case 'QUIT':
        this.send(session, `221 ${this.config.domain} closing connection`)
        session.socket.end()
        break

      default:
        this.send(session, '500 Unrecognized command')
    }
  }

  /**
   * Handle EHLO/HELO command
   */
  private async handleEhlo(session: SmtpSession, clientDomain: string): Promise<void> {
    const capabilities = [
      `250-${this.config.domain} Hello ${clientDomain}`,
      '250-SIZE 26214400', // 25MB max
      '250-8BITMIME',
      '250-PIPELINING',
    ]

    // Only advertise STARTTLS if not already secure and certs are available
    if (!session.secure && this.config.tls?.key) {
      capabilities.push('250-STARTTLS')
    }

    // Always advertise AUTH
    capabilities.push('250-AUTH PLAIN LOGIN')
    capabilities.push('250 OK')

    for (const cap of capabilities) {
      this.send(session, cap)
    }
  }

  /**
   * Handle STARTTLS command
   */
  private async handleStartTls(session: SmtpSession): Promise<void> {
    if (session.secure || session.tlsUpgraded) {
      this.send(session, '503 TLS already active')
      return
    }

    if (!this.config.tls?.key || !this.config.tls?.cert) {
      this.send(session, '454 TLS not available')
      return
    }

    this.send(session, '220 Ready to start TLS')

    const tlsOptions: tls.TlsOptions = {
      key: fs.readFileSync(this.config.tls.key),
      cert: fs.readFileSync(this.config.tls.cert),
      isServer: true,
    }

    // Upgrade the connection to TLS
    const tlsSocket = new tls.TLSSocket(session.socket, tlsOptions)

    // Replace the socket in the session
    session.socket = tlsSocket
    session.secure = true
    session.tlsUpgraded = true

    // Reset session state after STARTTLS
    this.resetSession(session)
  }

  /**
   * Handle AUTH command
   */
  private async handleAuth(session: SmtpSession, args: string): Promise<void> {
    const parts = args.split(' ')
    const mechanism = parts[0].toUpperCase()

    if (mechanism === 'PLAIN') {
      // AUTH PLAIN [base64-credentials]
      if (parts[1]) {
        await this.handleAuthPlain(session, parts[1])
      } else {
        this.send(session, '334 ')
        // Client will send credentials in next line
        session.state = 'ready' // Will handle in next command
      }
    } else if (mechanism === 'LOGIN') {
      // AUTH LOGIN - multi-step
      this.send(session, '334 VXNlcm5hbWU6') // "Username:" in base64
      // Set up state to receive username
      const originalHandler = session.socket.listeners('data')[0] as (...args: any[]) => void
      session.socket.removeAllListeners('data')

      let step = 'username'
      let username = ''

      session.socket.on('data', async (data) => {
        const line = data.toString().trim()

        if (step === 'username') {
          username = Buffer.from(line, 'base64').toString('utf-8')
          step = 'password'
          this.send(session, '334 UGFzc3dvcmQ6') // "Password:" in base64
        } else if (step === 'password') {
          const password = Buffer.from(line, 'base64').toString('utf-8')
          session.socket.removeAllListeners('data')
          session.socket.on('data', originalHandler)

          await this.authenticateUser(session, username, password)
        }
      })
    } else {
      this.send(session, '504 Unrecognized authentication mechanism')
    }
  }

  /**
   * Handle AUTH PLAIN credentials
   */
  private async handleAuthPlain(session: SmtpSession, credentials: string): Promise<void> {
    try {
      // AUTH PLAIN credentials are: \0username\0password in base64
      const decoded = Buffer.from(credentials, 'base64').toString('utf-8')
      const parts = decoded.split('\0')

      // Format can be: \0username\0password or authzid\0authcid\0password
      const username = parts.length === 3 ? parts[1] : parts[0]
      const password = parts.length === 3 ? parts[2] : parts[1]

      await this.authenticateUser(session, username, password)
    } catch (err) {
      this.send(session, '535 Authentication failed')
    }
  }

  /**
   * Authenticate a user
   */
  private async authenticateUser(session: SmtpSession, username: string, password: string): Promise<void> {
    // Strip domain from username if present (chris@stacksjs.com -> chris)
    const cleanUsername = username.includes('@') ? username.split('@')[0] : username

    const user = this.config.users[cleanUsername]

    if (user && user.password === password) {
      session.authenticated = true
      session.username = cleanUsername
      session.email = user.email
      this.send(session, '235 Authentication successful')
      console.log(`SMTP AUTH success: ${cleanUsername}`)
    } else {
      this.send(session, '535 Authentication failed')
      console.log(`SMTP AUTH failed: ${username}`)
    }
  }

  /**
   * Handle MAIL FROM command
   */
  private async handleMailFrom(session: SmtpSession, args: string): Promise<void> {
    if (!session.authenticated) {
      this.send(session, '530 Authentication required')
      return
    }

    // Parse: FROM:<address>
    const match = args.match(/FROM:\s*<([^>]*)>/i)
    if (!match) {
      this.send(session, '501 Syntax error in MAIL FROM')
      return
    }

    const fromAddress = match[1]

    // Verify the sender is allowed (must be from their domain)
    if (!fromAddress.endsWith(`@${this.config.domain}`)) {
      this.send(session, `553 Sender address must be from @${this.config.domain}`)
      return
    }

    session.mailFrom = fromAddress
    session.state = 'mail'
    this.send(session, '250 OK')
  }

  /**
   * Handle RCPT TO command
   */
  private async handleRcptTo(session: SmtpSession, args: string): Promise<void> {
    if (!session.authenticated) {
      this.send(session, '530 Authentication required')
      return
    }

    if (!session.mailFrom) {
      this.send(session, '503 MAIL FROM required first')
      return
    }

    // Parse: TO:<address>
    const match = args.match(/TO:\s*<([^>]*)>/i)
    if (!match) {
      this.send(session, '501 Syntax error in RCPT TO')
      return
    }

    session.rcptTo.push(match[1])
    session.state = 'rcpt'
    this.send(session, '250 OK')
  }

  /**
   * Handle DATA command
   */
  private async handleData(session: SmtpSession): Promise<void> {
    if (!session.authenticated) {
      this.send(session, '530 Authentication required')
      return
    }

    if (session.rcptTo.length === 0) {
      this.send(session, '503 RCPT TO required first')
      return
    }

    session.state = 'data'
    session.dataBuffer = ''
    this.send(session, '354 Start mail input; end with <CRLF>.<CRLF>')
  }

  /**
   * Handle a line during DATA phase
   */
  private async handleDataLine(session: SmtpSession, line: string): Promise<void> {
    if (line === '.') {
      // End of data
      await this.sendEmail(session)
    } else {
      // Handle dot-stuffing (lines starting with . have the dot removed)
      const actualLine = line.startsWith('.') ? line.slice(1) : line
      session.dataBuffer += actualLine + '\r\n'
    }
  }

  /**
   * Send the email via SES
   */
  private async sendEmail(session: SmtpSession): Promise<void> {
    try {
      const rawEmail = session.dataBuffer

      // Send via SES using SendRawEmail
      const result = await this.ses.sendRawEmail({
        source: session.mailFrom!,
        destinations: session.rcptTo,
        rawMessage: rawEmail,
      })

      console.log(`SMTP: Email sent via SES, MessageId: ${result.MessageId}`)

      // Store in Sent folder if S3 is configured (non-blocking, don't fail if this errors)
      if (this.s3 && this.config.sentBucket) {
        try {
          const sentKey = `${this.config.sentPrefix || 'sent/'}${session.email}/${Date.now()}-${result.MessageId}`
          await this.s3.putObject({
            bucket: this.config.sentBucket,
            key: sentKey,
            body: rawEmail,
            contentType: 'message/rfc822',
          })
          console.log(`SMTP: Email stored in S3: ${sentKey}`)
        } catch (s3Err: any) {
          // Log but don't fail - the email was already sent successfully
          console.error(`SMTP: Failed to store sent email in S3 (email was sent successfully):`, s3Err.message)
        }
      }

      this.send(session, `250 OK Message accepted, ID: ${result.MessageId}`)

      // Reset for next message
      this.resetSession(session)
    } catch (err: any) {
      console.error('SMTP: Failed to send email:', err.message)
      this.send(session, `451 Failed to send: ${err.message}`)
      this.resetSession(session)
    }
  }

  /**
   * Reset session state for next message
   */
  private resetSession(session: SmtpSession): void {
    session.state = 'ready'
    session.mailFrom = undefined
    session.rcptTo = []
    session.dataBuffer = ''
  }
}

/**
 * Start an SMTP server with the given configuration
 */
export async function startSmtpServer(config: SmtpServerConfig): Promise<SmtpServer> {
  const server = new SmtpServer(config)
  await server.start()
  return server
}
