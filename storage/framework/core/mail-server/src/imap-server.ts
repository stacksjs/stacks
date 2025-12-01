/**
 * IMAP Server with S3 Backend
 * 
 * Provides IMAP access to emails stored in S3
 */

import { createServer, type Socket } from 'net'
import { createServer as createTlsServer } from 'tls'
import { readFileSync, existsSync } from 'fs'
import { S3Client } from 'ts-cloud/aws'
import { createHash } from 'crypto'

interface User {
  email: string
  passwordHash: string
  mailbox: string
}

interface MailMessage {
  uid: number
  flags: string[]
  internalDate: Date
  size: number
  s3Key: string
  headers: {
    from?: string
    to?: string
    subject?: string
    date?: string
    messageId?: string
  }
}

interface ImapSession {
  authenticated: boolean
  user?: User
  selectedMailbox?: string
  messages: MailMessage[]
}

// In-memory user store (replace with DynamoDB in production)
const users: Map<string, User> = new Map()

// S3 configuration
const s3BucketName = process.env.EMAIL_BUCKET || 'stacks-production-email'
const s3Prefix = 'incoming/'

export class ImapServer {
  private s3: S3Client
  private server: any
  private sessions: Map<Socket, ImapSession> = new Map()

  constructor(private port: number = 993, private useTls: boolean = true) {
    this.s3 = new S3Client(process.env.AWS_REGION || 'us-east-1')
  }

  /**
   * Add a user to the mail server
   */
  addUser(email: string, password: string): void {
    const passwordHash = createHash('sha256').update(password).digest('hex')
    users.set(email.toLowerCase(), {
      email: email.toLowerCase(),
      passwordHash,
      mailbox: email.split('@')[0],
    })
    console.log(`Added user: ${email}`)
  }

  /**
   * Authenticate a user
   */
  private authenticate(email: string, password: string): User | null {
    const user = users.get(email.toLowerCase())
    if (!user) return null

    const passwordHash = createHash('sha256').update(password).digest('hex')
    if (user.passwordHash !== passwordHash) return null

    return user
  }

  /**
   * Load messages from S3 for a user
   */
  private async loadMessages(user: User): Promise<MailMessage[]> {
    const messages: MailMessage[] = []

    try {
      const objects = await this.s3.listAllObjects({
        bucket: s3BucketName,
        prefix: s3Prefix,
      })

      let uid = 1
      for (const obj of objects) {
        // Skip setup notification
        if (obj.Key.includes('AMAZON_SES_SETUP_NOTIFICATION')) continue

        try {
          const content = await this.s3.getObject(s3BucketName, obj.Key)
          const headers = this.parseHeaders(content)

          // Filter by recipient if needed
          const to = headers.to?.toLowerCase() || ''
          if (to.includes(user.email) || to.includes(user.mailbox)) {
            messages.push({
              uid: uid++,
              flags: ['\\Recent'],
              internalDate: new Date(obj.LastModified),
              size: obj.Size,
              s3Key: obj.Key,
              headers,
            })
          }
        } catch (e) {
          // Skip unreadable messages
        }
      }
    } catch (error) {
      console.error('Error loading messages:', error)
    }

    return messages
  }

  /**
   * Parse email headers
   */
  private parseHeaders(content: string): MailMessage['headers'] {
    const headers: MailMessage['headers'] = {}
    const lines = content.split('\n')

    for (const line of lines.slice(0, 100)) {
      const lower = line.toLowerCase()
      if (lower.startsWith('from:')) {
        headers.from = line.substring(5).trim()
      } else if (lower.startsWith('to:')) {
        headers.to = line.substring(3).trim()
      } else if (lower.startsWith('subject:')) {
        headers.subject = line.substring(8).trim()
      } else if (lower.startsWith('date:')) {
        headers.date = line.substring(5).trim()
      } else if (lower.startsWith('message-id:')) {
        headers.messageId = line.substring(11).trim()
      } else if (line.trim() === '') {
        break // End of headers
      }
    }

    return headers
  }

  /**
   * Handle IMAP commands
   */
  private async handleCommand(socket: Socket, session: ImapSession, tag: string, command: string, args: string): Promise<string> {
    const cmd = command.toUpperCase()

    switch (cmd) {
      case 'CAPABILITY':
        return `* CAPABILITY IMAP4rev1 AUTH=PLAIN AUTH=LOGIN\r\n${tag} OK CAPABILITY completed\r\n`

      case 'NOOP':
        return `${tag} OK NOOP completed\r\n`

      case 'LOGOUT':
        this.sessions.delete(socket)
        return `* BYE IMAP4rev1 Server logging out\r\n${tag} OK LOGOUT completed\r\n`

      case 'LOGIN':
        const loginMatch = args.match(/"?([^"\s]+)"?\s+"?([^"]+)"?/)
        if (loginMatch) {
          const [, email, password] = loginMatch
          const user = this.authenticate(email, password)
          if (user) {
            session.authenticated = true
            session.user = user
            session.messages = await this.loadMessages(user)
            return `${tag} OK LOGIN completed\r\n`
          }
        }
        return `${tag} NO LOGIN failed\r\n`

      case 'AUTHENTICATE':
        if (args.toUpperCase() === 'PLAIN') {
          // Handle PLAIN authentication
          return `+ \r\n` // Request credentials
        }
        return `${tag} NO Unsupported authentication mechanism\r\n`

      case 'LIST':
        if (!session.authenticated) {
          return `${tag} NO Not authenticated\r\n`
        }
        return `* LIST (\\HasNoChildren) "/" "INBOX"\r\n${tag} OK LIST completed\r\n`

      case 'LSUB':
        if (!session.authenticated) {
          return `${tag} NO Not authenticated\r\n`
        }
        return `* LSUB (\\HasNoChildren) "/" "INBOX"\r\n${tag} OK LSUB completed\r\n`

      case 'SELECT':
      case 'EXAMINE':
        if (!session.authenticated) {
          return `${tag} NO Not authenticated\r\n`
        }
        session.selectedMailbox = 'INBOX'
        const msgCount = session.messages.length
        const recent = session.messages.filter(m => m.flags.includes('\\Recent')).length
        return [
          `* ${msgCount} EXISTS`,
          `* ${recent} RECENT`,
          `* OK [UIDVALIDITY 1] UIDs valid`,
          `* OK [UIDNEXT ${msgCount + 1}] Predicted next UID`,
          `* FLAGS (\\Answered \\Flagged \\Deleted \\Seen \\Draft)`,
          `* OK [PERMANENTFLAGS (\\Answered \\Flagged \\Deleted \\Seen \\Draft \\*)] Limited`,
          `${tag} OK [READ-WRITE] SELECT completed`,
        ].join('\r\n') + '\r\n'

      case 'STATUS':
        if (!session.authenticated) {
          return `${tag} NO Not authenticated\r\n`
        }
        const statusCount = session.messages.length
        return `* STATUS "INBOX" (MESSAGES ${statusCount} RECENT 0 UNSEEN ${statusCount})\r\n${tag} OK STATUS completed\r\n`

      case 'FETCH':
        if (!session.authenticated || !session.selectedMailbox) {
          return `${tag} NO Not authenticated or no mailbox selected\r\n`
        }
        return await this.handleFetch(session, tag, args)

      case 'UID':
        if (!session.authenticated) {
          return `${tag} NO Not authenticated\r\n`
        }
        const uidArgs = args.split(' ')
        const uidCmd = uidArgs[0].toUpperCase()
        if (uidCmd === 'FETCH') {
          return await this.handleFetch(session, tag, uidArgs.slice(1).join(' '), true)
        }
        return `${tag} NO UID command not supported\r\n`

      case 'CLOSE':
        session.selectedMailbox = undefined
        return `${tag} OK CLOSE completed\r\n`

      case 'EXPUNGE':
        return `${tag} OK EXPUNGE completed\r\n`

      case 'SEARCH':
        if (!session.authenticated) {
          return `${tag} NO Not authenticated\r\n`
        }
        const uids = session.messages.map(m => m.uid).join(' ')
        return `* SEARCH ${uids}\r\n${tag} OK SEARCH completed\r\n`

      default:
        return `${tag} BAD Unknown command\r\n`
    }
  }

  /**
   * Handle FETCH command
   */
  private async handleFetch(session: ImapSession, tag: string, args: string, useUid: boolean = false): Promise<string> {
    const responses: string[] = []

    // Parse sequence set (simplified - just handle "1:*" or specific numbers)
    const seqMatch = args.match(/^(\d+|\d+:\*|\*)\s+\((.+)\)$/i) || args.match(/^(\d+|\d+:\*|\*)\s+(.+)$/i)
    if (!seqMatch) {
      return `${tag} BAD Invalid FETCH arguments\r\n`
    }

    const [, seqSet, items] = seqMatch
    const fetchItems = items.toUpperCase()

    for (const msg of session.messages) {
      const seqNum = msg.uid
      let response = `* ${seqNum} FETCH (`

      const parts: string[] = []

      if (fetchItems.includes('UID')) {
        parts.push(`UID ${msg.uid}`)
      }

      if (fetchItems.includes('FLAGS')) {
        parts.push(`FLAGS (${msg.flags.join(' ')})`)
      }

      if (fetchItems.includes('INTERNALDATE')) {
        const date = msg.internalDate.toUTCString().replace('GMT', '+0000')
        parts.push(`INTERNALDATE "${date}"`)
      }

      if (fetchItems.includes('RFC822.SIZE') || fetchItems.includes('BODY') || fetchItems.includes('ENVELOPE')) {
        parts.push(`RFC822.SIZE ${msg.size}`)
      }

      if (fetchItems.includes('ENVELOPE')) {
        const env = [
          `"${msg.headers.date || ''}"`,
          `"${msg.headers.subject || ''}"`,
          `((NIL NIL "${msg.headers.from?.split('@')[0] || ''}" "${msg.headers.from?.split('@')[1] || ''}"))`,
          `((NIL NIL "${msg.headers.from?.split('@')[0] || ''}" "${msg.headers.from?.split('@')[1] || ''}"))`,
          `((NIL NIL "${msg.headers.from?.split('@')[0] || ''}" "${msg.headers.from?.split('@')[1] || ''}"))`,
          `((NIL NIL "${msg.headers.to?.split('@')[0] || ''}" "${msg.headers.to?.split('@')[1] || ''}"))`,
          'NIL',
          'NIL',
          'NIL',
          `"${msg.headers.messageId || ''}"`,
        ].join(' ')
        parts.push(`ENVELOPE (${env})`)
      }

      if (fetchItems.includes('BODY[]') || fetchItems.includes('RFC822')) {
        try {
          const content = await this.s3.getObject(s3BucketName, msg.s3Key)
          parts.push(`BODY[] {${content.length}}\r\n${content}`)
        } catch (e) {
          parts.push(`BODY[] {0}\r\n`)
        }
      }

      if (fetchItems.includes('BODY[HEADER]') || fetchItems.includes('BODY.PEEK[HEADER]')) {
        try {
          const content = await this.s3.getObject(s3BucketName, msg.s3Key)
          const headerEnd = content.indexOf('\r\n\r\n')
          const headers = headerEnd > 0 ? content.substring(0, headerEnd + 4) : content.substring(0, 1000)
          parts.push(`BODY[HEADER] {${headers.length}}\r\n${headers}`)
        } catch (e) {
          parts.push(`BODY[HEADER] {0}\r\n`)
        }
      }

      if (fetchItems.includes('BODYSTRUCTURE')) {
        parts.push(`BODYSTRUCTURE ("TEXT" "PLAIN" ("CHARSET" "UTF-8") NIL NIL "7BIT" ${msg.size} ${Math.ceil(msg.size / 80)} NIL NIL NIL NIL)`)
      }

      response += parts.join(' ') + ')\r\n'
      responses.push(response)
    }

    responses.push(`${tag} OK FETCH completed\r\n`)
    return responses.join('')
  }

  /**
   * Handle client connection
   */
  private handleConnection(socket: Socket): void {
    const session: ImapSession = {
      authenticated: false,
      messages: [],
    }
    this.sessions.set(socket, session)

    // Send greeting
    socket.write('* OK IMAP4rev1 Stacks Mail Server ready\r\n')

    let buffer = ''

    socket.on('data', async (data) => {
      buffer += data.toString()

      // Process complete lines
      let lineEnd: number
      while ((lineEnd = buffer.indexOf('\r\n')) !== -1) {
        const line = buffer.substring(0, lineEnd)
        buffer = buffer.substring(lineEnd + 2)

        if (line.trim() === '') continue

        // Parse IMAP command: TAG COMMAND [ARGS]
        const match = line.match(/^(\S+)\s+(\S+)(?:\s+(.*))?$/)
        if (match) {
          const [, tag, command, args] = match
          const response = await this.handleCommand(socket, session, tag, command, args || '')
          socket.write(response)

          if (command.toUpperCase() === 'LOGOUT') {
            socket.end()
          }
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
   * Start the IMAP server
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
      console.log(`IMAP server listening on port ${this.port}`)
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

// Export for use
export { users }
