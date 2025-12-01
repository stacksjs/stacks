/**
 * SMTP Server with SES Backend
 * 
 * Provides SMTP access to send emails via SES
 */

import { createServer, type Socket } from 'net'
import { createServer as createTlsServer } from 'tls'
import { readFileSync, existsSync } from 'fs'
import { SESClient } from 'ts-cloud/aws'
import { createHash } from 'crypto'

interface SmtpSession {
  authenticated: boolean
  user?: string
  from?: string
  to: string[]
  data: string
  state: 'COMMAND' | 'DATA' | 'AUTH'
  authMethod?: string
}

// Reference to users from IMAP server
import { users } from './imap-server'

export class SmtpServer {
  private ses: SESClient
  private server: any
  private sessions: Map<Socket, SmtpSession> = new Map()
  private domain: string

  constructor(
    private port: number = 465,
    private useTls: boolean = true,
    domain: string = 'stacksjs.com'
  ) {
    this.ses = new SESClient(process.env.AWS_REGION || 'us-east-1')
    this.domain = domain
  }

  /**
   * Authenticate user
   */
  private authenticate(credentials: string): string | null {
    try {
      // PLAIN auth: base64(authzid\0authcid\0password)
      const decoded = Buffer.from(credentials, 'base64').toString('utf-8')
      const parts = decoded.split('\0')
      
      const email = parts[1] || parts[0]
      const password = parts[2] || parts[1]

      if (!email || !password) return null

      const user = users.get(email.toLowerCase())
      if (!user) return null

      const passwordHash = createHash('sha256').update(password).digest('hex')
      if (user.passwordHash !== passwordHash) return null

      return email
    } catch (e) {
      return null
    }
  }

  /**
   * Send email via SES
   */
  private async sendEmail(session: SmtpSession): Promise<boolean> {
    try {
      // Parse the email data
      const lines = session.data.split('\r\n')
      let subject = ''
      let body = ''
      let inBody = false
      let contentType = 'text/plain'

      for (const line of lines) {
        if (inBody) {
          body += line + '\r\n'
        } else if (line === '') {
          inBody = true
        } else if (line.toLowerCase().startsWith('subject:')) {
          subject = line.substring(8).trim()
        } else if (line.toLowerCase().startsWith('content-type:')) {
          if (line.includes('text/html')) {
            contentType = 'text/html'
          }
        }
      }

      // Send via SES
      await this.ses.sendEmail({
        FromEmailAddress: session.from!,
        Destination: {
          ToAddresses: session.to,
        },
        Content: {
          Simple: {
            Subject: { Data: subject || '(No Subject)' },
            Body: contentType === 'text/html'
              ? { Html: { Data: body } }
              : { Text: { Data: body } },
          },
        },
      })

      return true
    } catch (error) {
      console.error('Failed to send email:', error)
      return false
    }
  }

  /**
   * Handle SMTP commands
   */
  private async handleCommand(socket: Socket, session: SmtpSession, line: string): Promise<string> {
    // Handle DATA state
    if (session.state === 'DATA') {
      if (line === '.') {
        session.state = 'COMMAND'
        const success = await this.sendEmail(session)
        session.data = ''
        session.from = undefined
        session.to = []
        return success ? '250 OK Message queued\r\n' : '550 Failed to send message\r\n'
      }
      // Handle dot-stuffing
      session.data += (line.startsWith('..') ? line.substring(1) : line) + '\r\n'
      return '' // No response during DATA
    }

    // Handle AUTH state
    if (session.state === 'AUTH') {
      const user = this.authenticate(line)
      session.state = 'COMMAND'
      if (user) {
        session.authenticated = true
        session.user = user
        return '235 2.7.0 Authentication successful\r\n'
      }
      return '535 5.7.8 Authentication failed\r\n'
    }

    // Parse command
    const parts = line.split(' ')
    const command = (parts[0] || '').toUpperCase()

    switch (command) {
      case 'EHLO':
      case 'HELO':
        return [
          `250-mail.${this.domain} Hello`,
          '250-SIZE 10485760',
          '250-AUTH PLAIN LOGIN',
          '250-STARTTLS',
          '250 OK',
        ].join('\r\n') + '\r\n'

      case 'AUTH':
        const authMethod = parts[1]?.toUpperCase()
        if (authMethod === 'PLAIN') {
          if (parts[2]) {
            // Credentials provided inline
            const user = this.authenticate(parts[2])
            if (user) {
              session.authenticated = true
              session.user = user
              return '235 2.7.0 Authentication successful\r\n'
            }
            return '535 5.7.8 Authentication failed\r\n'
          }
          // Request credentials
          session.state = 'AUTH'
          session.authMethod = 'PLAIN'
          return '334 \r\n'
        }
        if (authMethod === 'LOGIN') {
          session.state = 'AUTH'
          session.authMethod = 'LOGIN'
          return '334 VXNlcm5hbWU6\r\n' // "Username:" in base64
        }
        return '504 5.5.4 Unrecognized authentication type\r\n'

      case 'MAIL':
        if (!session.authenticated) {
          return '530 5.7.0 Authentication required\r\n'
        }
        const fromMatch = line.match(/FROM:<([^>]+)>/i)
        if (fromMatch) {
          session.from = fromMatch[1]
          return '250 2.1.0 Sender OK\r\n'
        }
        return '501 5.1.7 Bad sender address syntax\r\n'

      case 'RCPT':
        if (!session.from) {
          return '503 5.5.1 Need MAIL command first\r\n'
        }
        const toMatch = line.match(/TO:<([^>]+)>/i)
        if (toMatch && toMatch[1]) {
          session.to.push(toMatch[1])
          return '250 2.1.5 Recipient OK\r\n'
        }
        return '501 5.1.3 Bad recipient address syntax\r\n'

      case 'DATA':
        if (session.to.length === 0) {
          return '503 5.5.1 Need RCPT command first\r\n'
        }
        session.state = 'DATA'
        session.data = ''
        return '354 Start mail input; end with <CRLF>.<CRLF>\r\n'

      case 'RSET':
        session.from = undefined
        session.to = []
        session.data = ''
        session.state = 'COMMAND'
        return '250 2.0.0 Reset OK\r\n'

      case 'NOOP':
        return '250 2.0.0 OK\r\n'

      case 'QUIT':
        return '221 2.0.0 Bye\r\n'

      case 'STARTTLS':
        return '220 2.0.0 Ready to start TLS\r\n'

      default:
        return '502 5.5.2 Command not implemented\r\n'
    }
  }

  /**
   * Handle client connection
   */
  private handleConnection(socket: Socket): void {
    const session: SmtpSession = {
      authenticated: false,
      to: [],
      data: '',
      state: 'COMMAND',
    }
    this.sessions.set(socket, session)

    // Send greeting
    socket.write(`220 mail.${this.domain} ESMTP Stacks Mail Server\r\n`)

    let buffer = ''

    socket.on('data', async (data) => {
      buffer += data.toString()

      // Process complete lines
      let lineEnd: number
      while ((lineEnd = buffer.indexOf('\r\n')) !== -1) {
        const line = buffer.substring(0, lineEnd)
        buffer = buffer.substring(lineEnd + 2)

        const response = await this.handleCommand(socket, session, line)
        if (response) {
          socket.write(response)
        }

        if (line.toUpperCase() === 'QUIT') {
          socket.end()
        }
      }
    })

    socket.on('error', (err) => {
      console.error('Socket error:', err.message)
      this.sessions.delete(socket)
    })

    socket.on('close', () => {
      this.sessions.delete(socket)
    })
  }

  /**
   * Start the SMTP server
   */
  async start(): Promise<void> {
    if (this.useTls) {
      const certPath = process.env.TLS_CERT_PATH || '/etc/ssl/certs/mail.crt'
      const keyPath = process.env.TLS_KEY_PATH || '/etc/ssl/private/mail.key'

      if (existsSync(certPath) && existsSync(keyPath)) {
        this.server = createTlsServer({
          cert: readFileSync(certPath),
          key: readFileSync(keyPath),
        }, (socket) => this.handleConnection(socket))
      } else {
        console.warn('TLS certificates not found, starting without TLS')
        this.server = createServer((socket) => this.handleConnection(socket))
      }
    } else {
      this.server = createServer((socket) => this.handleConnection(socket))
    }

    this.server.listen(this.port, () => {
      console.log(`SMTP server listening on port ${this.port}`)
    })
  }

  /**
   * Stop the server
   */
  stop(): void {
    if (this.server) {
      this.server.close()
    }
  }
}
