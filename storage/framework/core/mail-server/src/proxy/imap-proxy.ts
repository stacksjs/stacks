/**
 * Local IMAP Proxy
 * 
 * Runs locally and translates IMAP protocol to our serverless Mail API.
 * This allows Mail.app and other standard email clients to connect.
 */

import { createServer, type Socket } from 'net'
import { createServer as createTlsServer } from 'tls'
import { readFileSync, existsSync } from 'fs'

interface ProxySession {
  authenticated: boolean
  user?: string
  token?: string
  selectedMailbox?: string
}

interface MailMessage {
  id: string
  uid: number
  from: string
  to: string
  subject: string
  date: string
  size: number
  flags: string[]
  content?: string
}

export class ImapProxy {
  private server: any
  private sessions: Map<Socket, ProxySession> = new Map()
  private apiUrl: string

  constructor(
    private port: number = 1993,
    apiUrl: string = process.env.MAIL_API_URL || 'https://mail-api.stacksjs.com'
  ) {
    this.apiUrl = apiUrl
  }

  /**
   * Make API request
   */
  private async apiRequest(path: string, options: {
    method?: string
    token?: string
    body?: any
  } = {}): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    
    if (options.token) {
      headers['Authorization'] = `Bearer ${options.token}`
    }

    const response = await fetch(`${this.apiUrl}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    return response.json()
  }

  /**
   * Authenticate user via API
   */
  private async authenticate(email: string, password: string): Promise<string | null> {
    try {
      const result = await this.apiRequest('/auth', {
        method: 'POST',
        body: { email, password },
      })
      return result.token
    } catch (e) {
      return null
    }
  }

  /**
   * Get messages from API
   */
  private async getMessages(token: string, mailbox: string = 'INBOX'): Promise<MailMessage[]> {
    try {
      const result = await this.apiRequest(`/messages?mailbox=${mailbox}&preview=true`, { token })
      return result.messages || []
    } catch (e) {
      return []
    }
  }

  /**
   * Get single message
   */
  private async getMessage(token: string, messageId: string): Promise<{ message: MailMessage; content: string } | null> {
    try {
      return await this.apiRequest(`/messages/${messageId}?format=raw`, { token })
    } catch (e) {
      return null
    }
  }

  /**
   * Handle IMAP commands
   */
  private async handleCommand(
    socket: Socket,
    session: ProxySession,
    tag: string,
    command: string,
    args: string
  ): Promise<string> {
    const cmd = command.toUpperCase()

    switch (cmd) {
      case 'CAPABILITY':
        return `* CAPABILITY IMAP4rev1 AUTH=PLAIN AUTH=LOGIN IDLE\r\n${tag} OK CAPABILITY completed\r\n`

      case 'NOOP':
        return `${tag} OK NOOP completed\r\n`

      case 'LOGOUT':
        this.sessions.delete(socket)
        return `* BYE IMAP4rev1 Server logging out\r\n${tag} OK LOGOUT completed\r\n`

      case 'LOGIN': {
        const loginMatch = args.match(/"?([^"\s]+)"?\s+"?([^"]+)"?/)
        if (loginMatch) {
          const [, email, password] = loginMatch
          const token = await this.authenticate(email, password)
          if (token) {
            session.authenticated = true
            session.user = email
            session.token = token
            return `${tag} OK LOGIN completed\r\n`
          }
        }
        return `${tag} NO LOGIN failed\r\n`
      }

      case 'LIST':
        if (!session.authenticated) {
          return `${tag} NO Not authenticated\r\n`
        }
        return [
          '* LIST (\\HasNoChildren) "/" "INBOX"',
          '* LIST (\\HasNoChildren \\Sent) "/" "Sent"',
          '* LIST (\\HasNoChildren \\Drafts) "/" "Drafts"',
          '* LIST (\\HasNoChildren \\Trash) "/" "Trash"',
          `${tag} OK LIST completed`,
        ].join('\r\n') + '\r\n'

      case 'LSUB':
        if (!session.authenticated) {
          return `${tag} NO Not authenticated\r\n`
        }
        return `* LSUB (\\HasNoChildren) "/" "INBOX"\r\n${tag} OK LSUB completed\r\n`

      case 'SELECT':
      case 'EXAMINE': {
        if (!session.authenticated || !session.token) {
          return `${tag} NO Not authenticated\r\n`
        }
        
        const mailbox = args.replace(/"/g, '') || 'INBOX'
        session.selectedMailbox = mailbox
        
        const messages = await this.getMessages(session.token, mailbox)
        const msgCount = messages.length
        
        return [
          `* ${msgCount} EXISTS`,
          `* 0 RECENT`,
          `* OK [UIDVALIDITY 1] UIDs valid`,
          `* OK [UIDNEXT ${msgCount + 1}] Predicted next UID`,
          `* FLAGS (\\Answered \\Flagged \\Deleted \\Seen \\Draft)`,
          `* OK [PERMANENTFLAGS (\\Answered \\Flagged \\Deleted \\Seen \\Draft \\*)] Limited`,
          `${tag} OK [READ-WRITE] ${cmd} completed`,
        ].join('\r\n') + '\r\n'
      }

      case 'STATUS': {
        if (!session.authenticated || !session.token) {
          return `${tag} NO Not authenticated\r\n`
        }
        
        const mailbox = args.split(' ')[0].replace(/"/g, '')
        const messages = await this.getMessages(session.token, mailbox)
        
        return `* STATUS "${mailbox}" (MESSAGES ${messages.length} RECENT 0 UNSEEN ${messages.length})\r\n${tag} OK STATUS completed\r\n`
      }

      case 'FETCH': {
        if (!session.authenticated || !session.token || !session.selectedMailbox) {
          return `${tag} NO Not authenticated or no mailbox selected\r\n`
        }
        return await this.handleFetch(session, tag, args)
      }

      case 'UID': {
        if (!session.authenticated || !session.token) {
          return `${tag} NO Not authenticated\r\n`
        }
        const uidArgs = args.split(' ')
        const uidCmd = uidArgs[0].toUpperCase()
        if (uidCmd === 'FETCH') {
          return await this.handleFetch(session, tag, uidArgs.slice(1).join(' '), true)
        }
        if (uidCmd === 'SEARCH') {
          const messages = await this.getMessages(session.token, session.selectedMailbox || 'INBOX')
          const uids = messages.map(m => m.uid).join(' ')
          return `* SEARCH ${uids}\r\n${tag} OK UID SEARCH completed\r\n`
        }
        return `${tag} NO UID command not supported\r\n`
      }

      case 'SEARCH': {
        if (!session.authenticated || !session.token) {
          return `${tag} NO Not authenticated\r\n`
        }
        const messages = await this.getMessages(session.token, session.selectedMailbox || 'INBOX')
        const uids = messages.map(m => m.uid).join(' ')
        return `* SEARCH ${uids}\r\n${tag} OK SEARCH completed\r\n`
      }

      case 'CLOSE':
        session.selectedMailbox = undefined
        return `${tag} OK CLOSE completed\r\n`

      case 'EXPUNGE':
        return `${tag} OK EXPUNGE completed\r\n`

      case 'IDLE':
        return `+ idling\r\n`

      case 'DONE':
        return `${tag} OK IDLE terminated\r\n`

      default:
        return `${tag} BAD Unknown command\r\n`
    }
  }

  /**
   * Handle FETCH command
   */
  private async handleFetch(session: ProxySession, tag: string, args: string, useUid: boolean = false): Promise<string> {
    if (!session.token) return `${tag} NO Not authenticated\r\n`
    
    const messages = await this.getMessages(session.token, session.selectedMailbox || 'INBOX')
    const responses: string[] = []

    // Parse fetch items
    const fetchItems = args.toUpperCase()

    for (const msg of messages) {
      const seqNum = msg.uid
      const parts: string[] = []

      if (fetchItems.includes('UID')) {
        parts.push(`UID ${msg.uid}`)
      }

      if (fetchItems.includes('FLAGS')) {
        parts.push(`FLAGS (${msg.flags?.join(' ') || ''})`)
      }

      if (fetchItems.includes('INTERNALDATE')) {
        const date = new Date(msg.date).toUTCString().replace('GMT', '+0000')
        parts.push(`INTERNALDATE "${date}"`)
      }

      if (fetchItems.includes('RFC822.SIZE') || fetchItems.includes('ENVELOPE')) {
        parts.push(`RFC822.SIZE ${msg.size}`)
      }

      if (fetchItems.includes('ENVELOPE')) {
        const fromParts = msg.from?.match(/<([^>]+)>/) || [null, msg.from]
        const toParts = msg.to?.match(/<([^>]+)>/) || [null, msg.to]
        const fromEmail = fromParts[1] || msg.from || ''
        const toEmail = toParts[1] || msg.to || ''
        
        const env = [
          `"${msg.date || ''}"`,
          `"${(msg.subject || '').replace(/"/g, '\\"')}"`,
          `((NIL NIL "${fromEmail.split('@')[0]}" "${fromEmail.split('@')[1] || ''}"))`,
          `((NIL NIL "${fromEmail.split('@')[0]}" "${fromEmail.split('@')[1] || ''}"))`,
          `((NIL NIL "${fromEmail.split('@')[0]}" "${fromEmail.split('@')[1] || ''}"))`,
          `((NIL NIL "${toEmail.split('@')[0]}" "${toEmail.split('@')[1] || ''}"))`,
          'NIL',
          'NIL',
          'NIL',
          `"<${msg.id}>"`,
        ].join(' ')
        parts.push(`ENVELOPE (${env})`)
      }

      if (fetchItems.includes('BODY[]') || fetchItems.includes('RFC822') || fetchItems.includes('BODY.PEEK')) {
        // Fetch full message content
        const fullMsg = await this.getMessage(session.token!, msg.id)
        if (fullMsg?.content) {
          parts.push(`BODY[] {${fullMsg.content.length}}\r\n${fullMsg.content}`)
        } else {
          // Construct minimal message
          const content = `From: ${msg.from}\r\nTo: ${msg.to}\r\nSubject: ${msg.subject}\r\nDate: ${msg.date}\r\n\r\n${msg.content || ''}`
          parts.push(`BODY[] {${content.length}}\r\n${content}`)
        }
      }

      if (fetchItems.includes('BODYSTRUCTURE')) {
        parts.push(`BODYSTRUCTURE ("TEXT" "PLAIN" ("CHARSET" "UTF-8") NIL NIL "7BIT" ${msg.size} ${Math.ceil(msg.size / 80)} NIL NIL NIL NIL)`)
      }

      if (parts.length > 0) {
        responses.push(`* ${seqNum} FETCH (${parts.join(' ')})\r\n`)
      }
    }

    responses.push(`${tag} OK FETCH completed\r\n`)
    return responses.join('')
  }

  /**
   * Handle client connection
   */
  private handleConnection(socket: Socket): void {
    const session: ProxySession = {
      authenticated: false,
    }
    this.sessions.set(socket, session)

    // Send greeting
    socket.write('* OK IMAP4rev1 Stacks Mail Proxy ready\r\n')

    let buffer = ''

    socket.on('data', async (data) => {
      buffer += data.toString()

      // Process complete lines
      let lineEnd: number
      while ((lineEnd = buffer.indexOf('\r\n')) !== -1) {
        const line = buffer.substring(0, lineEnd)
        buffer = buffer.substring(lineEnd + 2)

        if (line.trim() === '') continue

        // Handle DONE for IDLE
        if (line.toUpperCase() === 'DONE' && session.authenticated) {
          // Find the last tag used
          socket.write(`* OK IDLE terminated\r\n`)
          continue
        }

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
   * Start the proxy server
   */
  async start(): Promise<void> {
    // Check for TLS certificates
    const certPath = process.env.TLS_CERT_PATH
    const keyPath = process.env.TLS_KEY_PATH

    if (certPath && keyPath && existsSync(certPath) && existsSync(keyPath)) {
      this.server = createTlsServer({
        cert: readFileSync(certPath),
        key: readFileSync(keyPath),
      }, (socket) => this.handleConnection(socket))
      console.log(`IMAP Proxy (TLS) listening on port ${this.port}`)
    } else {
      this.server = createServer((socket) => this.handleConnection(socket))
      console.log(`IMAP Proxy listening on port ${this.port}`)
    }

    this.server.listen(this.port)
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

// CLI entry point
if (import.meta.main) {
  const proxy = new ImapProxy(
    parseInt(process.env.IMAP_PORT || '1993'),
    process.env.MAIL_API_URL || 'https://mail-api.stacksjs.com'
  )
  
  proxy.start()
  
  console.log('\n📧 IMAP Proxy Started!')
  console.log('─────────────────────────────────────────')
  console.log('Configure Mail.app with these settings:')
  console.log('')
  console.log('  Incoming Mail Server: localhost')
  console.log('  Port: 1993')
  console.log('  SSL: No (local connection)')
  console.log('  Username: your-email@stacksjs.com')
  console.log('  Password: your-password')
  console.log('─────────────────────────────────────────\n')

  process.on('SIGINT', () => {
    console.log('\nShutting down...')
    proxy.stop()
    process.exit(0)
  })
}
