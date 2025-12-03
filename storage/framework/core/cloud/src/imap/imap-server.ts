/**
 * IMAP-to-S3 Bridge Server
 * Provides IMAP access to emails stored in S3 via SES receipt rules
 *
 * This allows email clients like Mail.app to access emails that are
 * stored in S3 buckets through SES inbound email processing.
 */

import * as net from 'node:net'
import * as tls from 'node:tls'
import * as fs from 'node:fs'
import * as crypto from 'node:crypto'

export interface ImapServerConfig {
  port?: number
  sslPort?: number
  host?: string
  region?: string
  bucket: string
  prefix?: string
  domain: string
  users: Record<string, { password: string; email: string }>
  tls?: {
    key: string
    cert: string
  }
}

interface ImapSession {
  id: string
  socket: net.Socket
  state: 'not_authenticated' | 'authenticated' | 'selected' | 'logout'
  username?: string
  email?: string
  selectedMailbox?: string
  tag?: string
  idling?: boolean
  idleTag?: string
}

interface EmailMessage {
  uid: number
  key: string
  size: number
  date: Date
  flags: string[]
  from?: string
  to?: string
  subject?: string
  raw?: string
}

// Simple S3 client that uses direct HTTP requests
class SimpleS3Client {
  private region: string
  private accessKeyId: string
  private secretAccessKey: string

  constructor(region: string) {
    this.region = region
    this.accessKeyId = process.env.AWS_ACCESS_KEY_ID || ''
    this.secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || ''
  }

  private async sign(method: string, path: string, headers: Record<string, string>, payload: string): Promise<Record<string, string>> {
    const algorithm = 'AWS4-HMAC-SHA256'
    const service = 's3'
    const now = new Date()
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
    const dateStamp = amzDate.substring(0, 8)

    const payloadHash = crypto.createHash('sha256').update(payload).digest('hex')
    headers['x-amz-content-sha256'] = payloadHash
    headers['x-amz-date'] = amzDate

    const canonicalHeaders = Object.entries(headers)
      .sort(([a], [b]) => a.toLowerCase().localeCompare(b.toLowerCase()))
      .map(([k, v]) => `${k.toLowerCase()}:${v.trim()}`)
      .join('\n')

    const signedHeaders = Object.keys(headers)
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
      .map(k => k.toLowerCase())
      .join(';')

    const canonicalRequest = [
      method,
      path,
      '',
      canonicalHeaders,
      '',
      signedHeaders,
      payloadHash,
    ].join('\n')

    const credentialScope = `${dateStamp}/${this.region}/${service}/aws4_request`
    const stringToSign = [
      algorithm,
      amzDate,
      credentialScope,
      crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n')

    const kDate = crypto.createHmac('sha256', `AWS4${this.secretAccessKey}`).update(dateStamp).digest()
    const kRegion = crypto.createHmac('sha256', kDate).update(this.region).digest()
    const kService = crypto.createHmac('sha256', kRegion).update(service).digest()
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest()
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex')

    headers['Authorization'] = `${algorithm} Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

    return headers
  }

  async list(params: { bucket: string; prefix?: string; maxKeys?: number }): Promise<Array<{ Key: string; Size: number; LastModified: string }>> {
    const prefix = params.prefix || ''
    const maxKeys = params.maxKeys || 1000
    const host = `${params.bucket}.s3.${this.region}.amazonaws.com`
    const path = `/?list-type=2&prefix=${encodeURIComponent(prefix)}&max-keys=${maxKeys}`

    const headers: Record<string, string> = {
      Host: host,
    }

    const signedHeaders = await this.sign('GET', path, headers, '')

    const response = await fetch(`https://${host}${path}`, {
      method: 'GET',
      headers: signedHeaders,
    })

    const xml = await response.text()
    const results: Array<{ Key: string; Size: number; LastModified: string }> = []

    // Simple XML parsing for Contents
    const contentMatches = xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)
    for (const match of contentMatches) {
      const content = match[1]
      const keyMatch = content.match(/<Key>(.*?)<\/Key>/)
      const sizeMatch = content.match(/<Size>(.*?)<\/Size>/)
      const dateMatch = content.match(/<LastModified>(.*?)<\/LastModified>/)

      if (keyMatch) {
        results.push({
          Key: keyMatch[1],
          Size: sizeMatch ? Number.parseInt(sizeMatch[1], 10) : 0,
          LastModified: dateMatch ? dateMatch[1] : new Date().toISOString(),
        })
      }
    }

    return results
  }

  async getObject(bucket: string, key: string): Promise<string> {
    const host = `${bucket}.s3.${this.region}.amazonaws.com`
    const path = `/${encodeURIComponent(key).replace(/%2F/g, '/')}`

    const headers: Record<string, string> = {
      Host: host,
    }

    const signedHeaders = await this.sign('GET', path, headers, '')

    const response = await fetch(`https://${host}${path}`, {
      method: 'GET',
      headers: signedHeaders,
    })

    if (!response.ok) {
      throw new Error(`Failed to get object: ${response.status} ${response.statusText}`)
    }

    return await response.text()
  }

  async putObject(params: { bucket: string; key: string; body: string; contentType?: string }): Promise<void> {
    const host = `${params.bucket}.s3.${this.region}.amazonaws.com`
    const path = `/${encodeURIComponent(params.key).replace(/%2F/g, '/')}`

    const headers: Record<string, string> = {
      Host: host,
      'Content-Type': params.contentType || 'application/octet-stream',
    }

    const signedHeaders = await this.sign('PUT', path, headers, params.body)

    const response = await fetch(`https://${host}${path}`, {
      method: 'PUT',
      headers: signedHeaders,
      body: params.body,
    })

    if (!response.ok) {
      throw new Error(`Failed to put object: ${response.status} ${response.statusText}`)
    }
  }

  async deleteObject(bucket: string, key: string): Promise<void> {
    const host = `${bucket}.s3.${this.region}.amazonaws.com`
    const path = `/${encodeURIComponent(key).replace(/%2F/g, '/')}`

    const headers: Record<string, string> = {
      Host: host,
    }

    const signedHeaders = await this.sign('DELETE', path, headers, '')

    const response = await fetch(`https://${host}${path}`, {
      method: 'DELETE',
      headers: signedHeaders,
    })

    if (!response.ok && response.status !== 204) {
      throw new Error(`Failed to delete object: ${response.status} ${response.statusText}`)
    }
  }
}

/**
 * IMAP Server that reads emails from S3
 */
export class ImapServer {
  private config: ImapServerConfig
  private s3: SimpleS3Client
  private server?: net.Server
  private tlsServer?: tls.Server
  private sessions: Map<string, ImapSession> = new Map()
  private messageCache: Map<string, Map<string, EmailMessage[]>> = new Map() // email -> folder -> messages
  private flagsCache: Map<string, Record<string, string[]>> = new Map() // email -> {s3Key: flags[]}
  private cacheTimestamp: Map<string, number> = new Map()
  private uidCounter: Map<string, Map<string, number>> = new Map() // email -> folder -> uidCounter
  private readonly CACHE_TTL_MS = 10000 // 10 seconds cache TTL

  constructor(config: ImapServerConfig) {
    this.config = {
      port: 143,
      sslPort: 993,
      host: '0.0.0.0',
      prefix: 'incoming/',
      ...config,
    }
    this.s3 = new SimpleS3Client(config.region || 'us-east-1')
  }

  /**
   * Start the IMAP server
   */
  async start(): Promise<void> {
    // Start plain IMAP server
    this.server = net.createServer((socket) => {
      this.handleConnection(socket)
    })

    this.server.listen(this.config.port, this.config.host, () => {
      console.log(`IMAP server listening on ${this.config.host}:${this.config.port}`)
    })

    // Start TLS IMAP server if certificates provided
    if (this.config.tls?.key && this.config.tls?.cert) {
      const tlsOptions: tls.TlsOptions = {
        key: fs.readFileSync(this.config.tls.key),
        cert: fs.readFileSync(this.config.tls.cert),
      }

      this.tlsServer = tls.createServer(tlsOptions, (socket) => {
        this.handleConnection(socket)
      })

      this.tlsServer.listen(this.config.sslPort, this.config.host, () => {
        console.log(`IMAPS server listening on ${this.config.host}:${this.config.sslPort}`)
      })
    }
  }

  /**
   * Stop the IMAP server
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
   * Handle new connection
   */
  private handleConnection(socket: net.Socket): void {
    const sessionId = crypto.randomUUID()
    const session: ImapSession = {
      id: sessionId,
      socket,
      state: 'not_authenticated',
    }

    this.sessions.set(sessionId, session)

    // Send greeting
    this.send(session, `* OK [CAPABILITY IMAP4rev1 STARTTLS AUTH=PLAIN] ${this.config.domain} IMAP4rev1 ready`)

    let buffer = ''

    socket.on('data', async (data) => {
      buffer += data.toString()

      // Process complete lines
      let lineEnd: number
      while ((lineEnd = buffer.indexOf('\r\n')) !== -1) {
        const line = buffer.substring(0, lineEnd)
        buffer = buffer.substring(lineEnd + 2)

        try {
          await this.processCommand(session, line)
        }
        catch (err) {
          console.error(`Error processing command: ${err}`)
          this.send(session, `* BAD Internal server error`)
        }
      }
    })

    socket.on('close', () => {
      this.sessions.delete(sessionId)
    })

    socket.on('error', (err) => {
      console.error(`Socket error: ${err}`)
      this.sessions.delete(sessionId)
    })
  }

  /**
   * Send response to client
   */
  private send(session: ImapSession, message: string): void {
    session.socket.write(`${message}\r\n`)
  }

  /**
   * Process IMAP command
   */
  private async processCommand(session: ImapSession, line: string): Promise<void> {
    // Log command for debugging
    console.log(`IMAP CMD [${session.username || 'unauth'}]: ${line}`)

    // Handle DONE command (ends IDLE state) - no tag required
    if (line.toUpperCase() === 'DONE') {
      if (session.idling && session.idleTag) {
        session.idling = false
        this.send(session, `${session.idleTag} OK IDLE terminated`)
        session.idleTag = undefined
      }
      return
    }

    // Parse: TAG COMMAND [ARGS...]
    const match = line.match(/^(\S+)\s+(\S+)(?:\s+(.*))?$/)
    if (!match) {
      this.send(session, '* BAD Invalid command')
      return
    }

    const [, tag, command, args] = match
    const cmd = command.toUpperCase()

    switch (cmd) {
      case 'CAPABILITY':
        await this.handleCapability(session, tag)
        break
      case 'NOOP':
        this.send(session, `${tag} OK NOOP completed`)
        break
      case 'LOGOUT':
        await this.handleLogout(session, tag)
        break
      case 'LOGIN':
        await this.handleLogin(session, tag, args || '')
        break
      case 'AUTHENTICATE':
        await this.handleAuthenticate(session, tag, args || '')
        break
      case 'SELECT':
        await this.handleSelect(session, tag, args || '')
        break
      case 'EXAMINE':
        await this.handleExamine(session, tag, args || '')
        break
      case 'LIST':
        await this.handleList(session, tag, args || '')
        break
      case 'LSUB':
        await this.handleLsub(session, tag, args || '')
        break
      case 'STATUS':
        await this.handleStatus(session, tag, args || '')
        break
      case 'FETCH':
        await this.handleFetch(session, tag, args || '')
        break
      case 'UID':
        await this.handleUid(session, tag, args || '')
        break
      case 'SEARCH':
        await this.handleSearch(session, tag, args || '')
        break
      case 'CLOSE':
        await this.handleClose(session, tag)
        break
      case 'EXPUNGE':
        await this.handleExpunge(session, tag)
        break
      case 'STORE':
        await this.handleStore(session, tag, args || '')
        break
      case 'COPY':
        await this.handleCopy(session, tag, args || '')
        break
      case 'IDLE':
        await this.handleIdle(session, tag)
        break
      case 'STARTTLS':
        await this.handleStartTls(session, tag)
        break
      case 'NAMESPACE':
        await this.handleNamespace(session, tag)
        break
      case 'XLIST':
        await this.handleXlist(session, tag, args || '')
        break
      case 'CREATE':
        await this.handleCreate(session, tag, args || '')
        break
      case 'DELETE':
        await this.handleDelete(session, tag, args || '')
        break
      case 'SUBSCRIBE':
        await this.handleSubscribe(session, tag, args || '')
        break
      case 'UNSUBSCRIBE':
        await this.handleUnsubscribe(session, tag, args || '')
        break
      case 'RENAME':
        await this.handleRename(session, tag, args || '')
        break
      case 'APPEND':
        await this.handleAppend(session, tag, args || '')
        break
      case 'CHECK':
        await this.handleCheck(session, tag)
        break
      case 'MOVE':
        await this.handleMove(session, tag, args || '')
        break
      default:
        this.send(session, `${tag} BAD Unknown command ${cmd}`)
    }
  }

  /**
   * Handle CAPABILITY command
   */
  private async handleCapability(session: ImapSession, tag: string): Promise<void> {
    const capabilities = [
      'IMAP4rev1',
      'STARTTLS',
      'AUTH=PLAIN',
      'AUTH=LOGIN',
      'IDLE',
      'NAMESPACE',
      'UIDPLUS',
      'UNSELECT',
      'CHILDREN',
      'SPECIAL-USE',
      'MOVE',
    ]
    this.send(session, `* CAPABILITY ${capabilities.join(' ')}`)
    this.send(session, `${tag} OK CAPABILITY completed`)
  }

  /**
   * Handle LOGOUT command
   */
  private async handleLogout(session: ImapSession, tag: string): Promise<void> {
    this.send(session, `* BYE ${this.config.domain} IMAP4rev1 server logging out`)
    this.send(session, `${tag} OK LOGOUT completed`)
    session.state = 'logout'
    session.socket.end()
  }

  /**
   * Handle LOGIN command
   */
  private async handleLogin(session: ImapSession, tag: string, args: string): Promise<void> {
    // Parse LOGIN username password
    const match = args.match(/^"?([^"\s]+)"?\s+"?([^"\s]+)"?$/)
    if (!match) {
      this.send(session, `${tag} BAD Invalid LOGIN syntax`)
      return
    }

    const [, username, password] = match
    const user = this.config.users[username]

    if (!user || user.password !== password) {
      this.send(session, `${tag} NO LOGIN failed`)
      return
    }

    session.username = username
    session.email = user.email
    session.state = 'authenticated'
    this.send(session, `${tag} OK LOGIN completed`)
  }

  /**
   * Handle AUTHENTICATE command
   */
  private async handleAuthenticate(session: ImapSession, tag: string, _args: string): Promise<void> {
    this.send(session, `${tag} NO Use LOGIN command`)
  }

  /**
   * Handle SELECT command
   */
  private async handleSelect(session: ImapSession, tag: string, args: string): Promise<void> {
    if (session.state === 'not_authenticated') {
      this.send(session, `${tag} NO Must authenticate first`)
      return
    }

    // Parse mailbox name (might be quoted)
    const mailbox = args.replace(/^"(.*)"$/, '$1').toUpperCase()

    session.selectedMailbox = mailbox
    session.state = 'selected'

    // Load messages from S3 for this folder (force refresh on SELECT)
    await this.loadMessages(session, true)
    const messages = this.getMessagesForFolder(session.email || '', mailbox)

    const exists = messages.length
    const recent = messages.filter(m => m.flags.includes('\\Recent')).length
    const unseenIdx = messages.findIndex(m => !m.flags.includes('\\Seen'))
    const unseen = unseenIdx >= 0 ? unseenIdx + 1 : 0
    const uidnext = this.getUidCounterForFolder(session.email || '', mailbox) + 1

    const uidvalidity = this.getUidValidity(session.email || '')

    this.send(session, `* ${exists} EXISTS`)
    this.send(session, `* ${recent} RECENT`)
    this.send(session, `* OK [UNSEEN ${unseen || 1}] First unseen message`)
    this.send(session, `* OK [UIDVALIDITY ${uidvalidity}]`)
    this.send(session, `* OK [UIDNEXT ${uidnext}]`)
    this.send(session, `* FLAGS (\\Answered \\Flagged \\Deleted \\Seen \\Draft)`)
    this.send(session, `* OK [PERMANENTFLAGS (\\Answered \\Flagged \\Deleted \\Seen \\Draft \\*)]`)
    this.send(session, `${tag} OK [READ-WRITE] SELECT completed`)
  }

  /**
   * Handle EXAMINE command (read-only SELECT)
   */
  private async handleExamine(session: ImapSession, tag: string, args: string): Promise<void> {
    await this.handleSelect(session, tag, args)
  }

  /**
   * Handle CHECK command
   */
  private async handleCheck(session: ImapSession, tag: string): Promise<void> {
    if (session.state === 'selected') {
      await this.loadMessages(session, true)
      const folder = session.selectedMailbox || 'INBOX'
      const messages = this.getMessagesForFolder(session.email || '', folder)
      this.send(session, `* ${messages.length} EXISTS`)
    }
    this.send(session, `${tag} OK CHECK completed`)
  }

  /**
   * Handle LIST command
   */
  private async handleList(session: ImapSession, tag: string, args: string): Promise<void> {
    if (session.state === 'not_authenticated') {
      this.send(session, `${tag} NO Must authenticate first`)
      return
    }

    const match = args.match(/^"?([^"]*)"?\s+"?([^"]*)"?$/)
    if (!match) {
      this.send(session, `${tag} BAD Invalid LIST syntax`)
      return
    }

    const [, _reference, pattern] = match

    if (pattern === '*' || pattern === '%' || pattern === '') {
      this.send(session, `* LIST (\\HasNoChildren) "/" "INBOX"`)
      this.send(session, `* LIST (\\HasNoChildren \\Sent) "/" "Sent"`)
      this.send(session, `* LIST (\\HasNoChildren \\Drafts) "/" "Drafts"`)
      this.send(session, `* LIST (\\HasNoChildren \\Trash) "/" "Trash"`)
      this.send(session, `* LIST (\\HasNoChildren \\Junk) "/" "Junk"`)
      this.send(session, `* LIST (\\HasNoChildren \\Archive) "/" "Archive"`)
      this.send(session, `* LIST (\\HasNoChildren \\All) "/" "All Mail"`)
    }
    else if (pattern.toUpperCase() === 'INBOX') {
      this.send(session, `* LIST (\\HasNoChildren) "/" "INBOX"`)
    }
    else {
      const upperPattern = pattern.toUpperCase()
      if (upperPattern === 'SENT' || upperPattern === '*SENT*') {
        this.send(session, `* LIST (\\HasNoChildren \\Sent) "/" "Sent"`)
      }
      if (upperPattern === 'DRAFTS' || upperPattern === '*DRAFT*') {
        this.send(session, `* LIST (\\HasNoChildren \\Drafts) "/" "Drafts"`)
      }
      if (upperPattern === 'TRASH' || upperPattern === '*TRASH*') {
        this.send(session, `* LIST (\\HasNoChildren \\Trash) "/" "Trash"`)
      }
      if (upperPattern === 'JUNK' || upperPattern === 'SPAM' || upperPattern === '*JUNK*' || upperPattern === '*SPAM*') {
        this.send(session, `* LIST (\\HasNoChildren \\Junk) "/" "Junk"`)
      }
      if (upperPattern === 'ARCHIVE' || upperPattern === '*ARCHIVE*') {
        this.send(session, `* LIST (\\HasNoChildren \\Archive) "/" "Archive"`)
      }
    }

    this.send(session, `${tag} OK LIST completed`)
  }

  /**
   * Handle LSUB command
   */
  private async handleLsub(session: ImapSession, tag: string, args: string): Promise<void> {
    if (session.state === 'not_authenticated') {
      this.send(session, `${tag} NO Must authenticate first`)
      return
    }

    const match = args.match(/^"?([^"]*)"?\s+"?([^"]*)"?$/)
    if (!match) {
      this.send(session, `${tag} BAD Invalid LSUB syntax`)
      return
    }

    const [, _reference, pattern] = match

    if (pattern === '*' || pattern === '%' || pattern === '') {
      this.send(session, `* LSUB (\\HasNoChildren) "/" "INBOX"`)
      this.send(session, `* LSUB (\\HasNoChildren \\Sent) "/" "Sent"`)
      this.send(session, `* LSUB (\\HasNoChildren \\Drafts) "/" "Drafts"`)
      this.send(session, `* LSUB (\\HasNoChildren \\Trash) "/" "Trash"`)
      this.send(session, `* LSUB (\\HasNoChildren \\Junk) "/" "Junk"`)
      this.send(session, `* LSUB (\\HasNoChildren \\Archive) "/" "Archive"`)
      this.send(session, `* LSUB (\\HasNoChildren \\All) "/" "All Mail"`)
    }
    else if (pattern.toUpperCase() === 'INBOX') {
      this.send(session, `* LSUB (\\HasNoChildren) "/" "INBOX"`)
    }

    this.send(session, `${tag} OK LSUB completed`)
  }

  /**
   * Handle STATUS command
   */
  private async handleStatus(session: ImapSession, tag: string, args: string): Promise<void> {
    if (session.state === 'not_authenticated') {
      this.send(session, `${tag} NO Must authenticate first`)
      return
    }

    const match = args.match(/^"?([^"]+)"?\s+\(([^)]+)\)$/i)
    if (!match) {
      this.send(session, `${tag} BAD Invalid STATUS syntax`)
      return
    }

    const [, mailbox, itemsStr] = match

    // Load messages for the requested mailbox (not the selected one)
    await this.loadMessagesForFolder(session, mailbox)
    const messages = this.getMessagesForFolder(session.email || '', mailbox) || []
    const items = itemsStr.toUpperCase().split(/\s+/)
    const results: string[] = []

    for (const item of items) {
      switch (item) {
        case 'MESSAGES':
          results.push(`MESSAGES ${messages.length}`)
          break
        case 'RECENT':
          results.push(`RECENT ${messages.filter(m => m.flags.includes('\\Recent')).length}`)
          break
        case 'UIDNEXT':
          results.push(`UIDNEXT ${this.getUidCounterForFolder(session.email || '', mailbox) + 1}`)
          break
        case 'UIDVALIDITY':
          results.push(`UIDVALIDITY ${this.getUidValidity(session.email || '')}`)
          break
        case 'UNSEEN':
          results.push(`UNSEEN ${messages.filter(m => !m.flags.includes('\\Seen')).length}`)
          break
      }
    }

    this.send(session, `* STATUS "${mailbox}" (${results.join(' ')})`)
    this.send(session, `${tag} OK STATUS completed`)
  }

  /**
   * Handle FETCH command
   */
  private async handleFetch(session: ImapSession, tag: string, args: string): Promise<void> {
    if (session.state !== 'selected') {
      this.send(session, `${tag} NO Must select mailbox first`)
      return
    }

    const match = args.match(/^(\S+)\s+(.+)$/i)
    if (!match) {
      this.send(session, `${tag} BAD Invalid FETCH syntax`)
      return
    }

    const [, sequenceSet, itemsStr] = match
    const folder = session.selectedMailbox || 'INBOX'
    const messages = this.getMessagesForFolder(session.email || '', folder)
    const indices = this.parseSequenceSet(sequenceSet, messages.length)

    for (const idx of indices) {
      const msg = messages[idx - 1]
      if (!msg)
        continue

      const fetchData = await this.buildFetchResponse(session, msg, idx, itemsStr)
      this.send(session, `* ${idx} FETCH ${fetchData}`)
    }

    this.send(session, `${tag} OK FETCH completed`)
  }

  /**
   * Handle UID command
   */
  private async handleUid(session: ImapSession, tag: string, args: string): Promise<void> {
    if (session.state !== 'selected') {
      this.send(session, `${tag} NO Must select mailbox first`)
      return
    }

    const match = args.match(/^(\S+)\s+(.+)$/i)
    if (!match) {
      this.send(session, `${tag} BAD Invalid UID syntax`)
      return
    }

    const [, subCommand, subArgs] = match

    switch (subCommand.toUpperCase()) {
      case 'FETCH':
        await this.handleUidFetch(session, tag, subArgs)
        break
      case 'SEARCH':
        await this.handleUidSearch(session, tag, subArgs)
        break
      case 'STORE':
        await this.handleUidStore(session, tag, subArgs)
        break
      case 'COPY':
        await this.handleUidCopy(session, tag, subArgs)
        break
      case 'MOVE':
        await this.handleUidMove(session, tag, subArgs)
        break
      case 'EXPUNGE':
        await this.handleUidExpunge(session, tag, subArgs)
        break
      default:
        this.send(session, `${tag} BAD Unknown UID command`)
    }
  }

  /**
   * Handle UID FETCH
   */
  private async handleUidFetch(session: ImapSession, tag: string, args: string): Promise<void> {
    const match = args.match(/^(\S+)\s+(.+)$/i)
    if (!match) {
      this.send(session, `${tag} BAD Invalid UID FETCH syntax`)
      return
    }

    const [, uidSet, itemsStr] = match
    const folder = session.selectedMailbox || 'INBOX'
    const messages = this.getMessagesForFolder(session.email || '', folder)

    const maxUid = messages.length > 0 ? Math.max(...messages.map(m => m.uid)) : 0
    const uids = this.parseSequenceSet(uidSet, maxUid)

    for (const uid of uids) {
      const idx = messages.findIndex(m => m.uid === uid)
      if (idx === -1)
        continue

      const msg = messages[idx]
      const fetchData = await this.buildFetchResponse(session, msg, idx + 1, itemsStr, true)
      this.send(session, `* ${idx + 1} FETCH ${fetchData}`)
    }

    this.send(session, `${tag} OK UID FETCH completed`)
  }

  /**
   * Handle SEARCH command
   */
  private async handleSearch(session: ImapSession, tag: string, _args: string): Promise<void> {
    if (session.state !== 'selected') {
      this.send(session, `${tag} NO Must select mailbox first`)
      return
    }

    const folder = session.selectedMailbox || 'INBOX'
    const messages = this.getMessagesForFolder(session.email || '', folder)

    if (messages.length === 0) {
      this.send(session, `* SEARCH`)
    }
    else {
      const results = messages.map((_, i) => i + 1)
      this.send(session, `* SEARCH ${results.join(' ')}`)
    }
    this.send(session, `${tag} OK SEARCH completed`)
  }

  /**
   * Handle UID SEARCH
   */
  private async handleUidSearch(session: ImapSession, tag: string, _args: string): Promise<void> {
    const folder = session.selectedMailbox || 'INBOX'
    const messages = this.getMessagesForFolder(session.email || '', folder)

    if (messages.length === 0) {
      this.send(session, `* SEARCH`)
    }
    else {
      const results = messages.map(m => m.uid)
      this.send(session, `* SEARCH ${results.join(' ')}`)
    }
    this.send(session, `${tag} OK UID SEARCH completed`)
  }

  /**
   * Handle STORE command
   */
  private async handleStore(session: ImapSession, tag: string, args: string): Promise<void> {
    if (session.state !== 'selected') {
      this.send(session, `${tag} NO Must select mailbox first`)
      return
    }

    const match = args.match(/^(\S+)\s+([+-]?FLAGS(?:\.SILENT)?)\s+\(([^)]*)\)/i)
    if (!match) {
      this.send(session, `${tag} BAD Invalid STORE syntax`)
      return
    }

    const [, sequenceSet, operation, flagsStr] = match
    const folder = session.selectedMailbox || 'INBOX'
    const messages = this.getMessagesForFolder(session.email || '', folder)
    const indices = this.parseSequenceSet(sequenceSet, messages.length)
    const silent = operation.toUpperCase().includes('.SILENT')
    const flags = flagsStr.split(/\s+/).filter(f => f)

    const persistedFlags = await this.loadFlags(session.email || '')

    for (const idx of indices) {
      const msg = messages[idx - 1]
      if (!msg)
        continue

      if (operation.startsWith('+')) {
        for (const flag of flags) {
          if (!msg.flags.includes(flag)) {
            msg.flags.push(flag)
          }
        }
      }
      else if (operation.startsWith('-')) {
        msg.flags = msg.flags.filter(f => !flags.includes(f))
      }
      else {
        msg.flags = [...flags]
      }

      persistedFlags[msg.key] = [...msg.flags]

      if (!silent) {
        this.send(session, `* ${idx} FETCH (FLAGS (${msg.flags.join(' ')}))`)
      }
    }

    await this.saveFlags(session.email || '')

    this.send(session, `${tag} OK STORE completed`)
  }

  /**
   * Handle UID STORE
   */
  private async handleUidStore(session: ImapSession, tag: string, args: string): Promise<void> {
    if (session.state !== 'selected') {
      this.send(session, `${tag} NO Must select mailbox first`)
      return
    }

    const match = args.match(/^(\S+)\s+([+-]?FLAGS(?:\.SILENT)?)\s+\(([^)]*)\)/i)
    if (!match) {
      this.send(session, `${tag} BAD Invalid UID STORE syntax`)
      return
    }

    const [, uidSet, operation, flagsStr] = match
    const folder = session.selectedMailbox || 'INBOX'
    const messages = this.getMessagesForFolder(session.email || '', folder)
    const maxUid = messages.length > 0 ? Math.max(...messages.map(m => m.uid)) : 0
    const uids = this.parseSequenceSet(uidSet, maxUid)
    const silent = operation.toUpperCase().includes('.SILENT')
    const flags = flagsStr.split(/\s+/).filter(f => f)

    const persistedFlags = await this.loadFlags(session.email || '')

    for (const uid of uids) {
      const idx = messages.findIndex(m => m.uid === uid)
      if (idx === -1)
        continue

      const msg = messages[idx]

      if (operation.startsWith('+')) {
        for (const flag of flags) {
          if (!msg.flags.includes(flag)) {
            msg.flags.push(flag)
          }
        }
      }
      else if (operation.startsWith('-')) {
        msg.flags = msg.flags.filter(f => !flags.includes(f))
      }
      else {
        msg.flags = [...flags]
      }

      persistedFlags[msg.key] = [...msg.flags]

      if (!silent) {
        this.send(session, `* ${idx + 1} FETCH (UID ${msg.uid} FLAGS (${msg.flags.join(' ')}))`)
      }
    }

    await this.saveFlags(session.email || '')

    this.send(session, `${tag} OK UID STORE completed`)
  }

  /**
   * Handle COPY command
   */
  private async handleCopy(session: ImapSession, tag: string, args: string): Promise<void> {
    if (session.state !== 'selected') {
      this.send(session, `${tag} NO Must select mailbox first`)
      return
    }

    const match = args.match(/^(\S+)\s+"?([^"]+)"?$/i)
    if (!match) {
      this.send(session, `${tag} BAD Invalid COPY syntax`)
      return
    }

    const [, sequenceSet, destMailbox] = match
    const sourceFolder = session.selectedMailbox || 'INBOX'
    const messages = this.getMessagesForFolder(session.email || '', sourceFolder)
    const indices = this.parseSequenceSet(sequenceSet, messages.length)

    const destPrefix = this.getFolderPrefix(destMailbox)

    for (const idx of indices) {
      const msg = messages[idx - 1]
      if (!msg)
        continue

      try {
        const content = msg.raw || await this.s3.getObject(this.config.bucket, msg.key)
        const filename = msg.key.split('/').pop() || `${Date.now()}`
        const newKey = `${destPrefix}${filename}`

        await this.s3.putObject({
          bucket: this.config.bucket,
          key: newKey,
          body: content,
          contentType: 'message/rfc822',
        })

        console.log(`Copied message from ${msg.key} to ${newKey}`)
      }
      catch (err) {
        console.error(`Failed to copy message: ${err}`)
      }
    }

    this.send(session, `${tag} OK COPY completed`)
  }

  /**
   * Handle UID COPY
   */
  private async handleUidCopy(session: ImapSession, tag: string, args: string): Promise<void> {
    if (session.state !== 'selected') {
      this.send(session, `${tag} NO Must select mailbox first`)
      return
    }

    const match = args.match(/^(\S+)\s+"?([^"]+)"?$/i)
    if (!match) {
      this.send(session, `${tag} BAD Invalid UID COPY syntax`)
      return
    }

    const [, uidSet, destMailbox] = match
    const sourceFolder = session.selectedMailbox || 'INBOX'
    const messages = this.getMessagesForFolder(session.email || '', sourceFolder)
    const maxUid = messages.length > 0 ? Math.max(...messages.map(m => m.uid)) : 0
    const uids = this.parseSequenceSet(uidSet, maxUid)

    const destPrefix = this.getFolderPrefix(destMailbox)

    for (const uid of uids) {
      const msg = messages.find(m => m.uid === uid)
      if (!msg)
        continue

      try {
        const content = msg.raw || await this.s3.getObject(this.config.bucket, msg.key)
        const filename = msg.key.split('/').pop() || `${Date.now()}`
        const newKey = `${destPrefix}${filename}`

        await this.s3.putObject({
          bucket: this.config.bucket,
          key: newKey,
          body: content,
          contentType: 'message/rfc822',
        })

        console.log(`UID COPY: Copied message from ${msg.key} to ${newKey}`)
      }
      catch (err) {
        console.error(`Failed to copy message: ${err}`)
      }
    }

    this.send(session, `${tag} OK UID COPY completed`)
  }

  /**
   * Handle MOVE command
   */
  private async handleMove(session: ImapSession, tag: string, args: string): Promise<void> {
    if (session.state !== 'selected') {
      this.send(session, `${tag} NO Must select mailbox first`)
      return
    }

    const match = args.match(/^(\S+)\s+"?([^"]+)"?$/i)
    if (!match) {
      this.send(session, `${tag} BAD Invalid MOVE syntax`)
      return
    }

    const [, sequenceSet, destMailbox] = match
    const sourceFolder = session.selectedMailbox || 'INBOX'
    const messages = this.getMessagesForFolder(session.email || '', sourceFolder)
    const indices = this.parseSequenceSet(sequenceSet, messages.length)
    const destPrefix = this.getFolderPrefix(destMailbox)

    const movedIndices: number[] = []

    for (const idx of indices) {
      const msg = messages[idx - 1]
      if (!msg)
        continue

      try {
        const content = msg.raw || await this.s3.getObject(this.config.bucket, msg.key)
        const filename = msg.key.split('/').pop() || `${Date.now()}`
        const newKey = `${destPrefix}${filename}`

        await this.s3.putObject({
          bucket: this.config.bucket,
          key: newKey,
          body: content,
          contentType: 'message/rfc822',
        })

        await this.s3.deleteObject(this.config.bucket, msg.key)
        console.log(`MOVE: ${msg.key} -> ${newKey}`)
        movedIndices.push(idx)
      }
      catch (err) {
        console.error(`Failed to move message: ${err}`)
      }
    }

    const sortedIndices = [...movedIndices].sort((a, b) => b - a)
    for (const idx of sortedIndices) {
      this.send(session, `* ${idx} EXPUNGE`)
    }

    const remainingMessages = messages.filter((_, i) => !movedIndices.includes(i + 1))
    this.setMessagesForFolder(session.email || '', sourceFolder, remainingMessages)

    this.send(session, `* ${remainingMessages.length} EXISTS`)

    this.send(session, `${tag} OK MOVE completed`)
  }

  /**
   * Handle UID MOVE
   */
  private async handleUidMove(session: ImapSession, tag: string, args: string): Promise<void> {
    if (session.state !== 'selected') {
      this.send(session, `${tag} NO Must select mailbox first`)
      return
    }

    const match = args.match(/^(\S+)\s+"?([^"]+)"?$/i)
    if (!match) {
      this.send(session, `${tag} BAD Invalid UID MOVE syntax`)
      return
    }

    const [, uidSet, destMailbox] = match
    const sourceFolder = session.selectedMailbox || 'INBOX'
    const messages = this.getMessagesForFolder(session.email || '', sourceFolder)
    const maxUid = messages.length > 0 ? Math.max(...messages.map(m => m.uid)) : 0
    const uids = this.parseSequenceSet(uidSet, maxUid)
    const destPrefix = this.getFolderPrefix(destMailbox)

    const movedIndices: number[] = []

    for (const uid of uids) {
      const idx = messages.findIndex(m => m.uid === uid)
      if (idx === -1)
        continue

      const msg = messages[idx]

      try {
        const content = msg.raw || await this.s3.getObject(this.config.bucket, msg.key)
        const filename = msg.key.split('/').pop() || `${Date.now()}`
        const newKey = `${destPrefix}${filename}`

        await this.s3.putObject({
          bucket: this.config.bucket,
          key: newKey,
          body: content,
          contentType: 'message/rfc822',
        })

        await this.s3.deleteObject(this.config.bucket, msg.key)
        console.log(`UID MOVE: ${msg.key} -> ${newKey}`)
        movedIndices.push(idx + 1)
      }
      catch (err) {
        console.error(`Failed to move message: ${err}`)
      }
    }

    const sortedIndices = [...movedIndices].sort((a, b) => b - a)
    for (const idx of sortedIndices) {
      this.send(session, `* ${idx} EXPUNGE`)
    }

    const remainingMessages = messages.filter((_, i) => !movedIndices.includes(i + 1))
    this.setMessagesForFolder(session.email || '', sourceFolder, remainingMessages)

    this.send(session, `* ${remainingMessages.length} EXISTS`)

    this.send(session, `${tag} OK UID MOVE completed`)
  }

  /**
   * Handle UID EXPUNGE
   */
  private async handleUidExpunge(session: ImapSession, tag: string, args: string): Promise<void> {
    if (session.state !== 'selected') {
      this.send(session, `${tag} NO Must select mailbox first`)
      return
    }

    const folder = session.selectedMailbox || 'INBOX'
    const messages = this.getMessagesForFolder(session.email || '', folder)

    const uidSet = args.trim()
    const maxUid = messages.length > 0 ? Math.max(...messages.map(m => m.uid)) : 0
    const uids = this.parseSequenceSet(uidSet, maxUid)

    const indicesToExpunge: number[] = []
    const keysToDelete: string[] = []

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]
      if (uids.includes(msg.uid) && msg.flags.includes('\\Deleted')) {
        indicesToExpunge.push(i + 1)
        keysToDelete.push(msg.key)
      }
    }

    for (const key of keysToDelete) {
      try {
        await this.s3.deleteObject(this.config.bucket, key)
        console.log(`Deleted from S3: ${key}`)
      }
      catch (err) {
        console.error(`Failed to delete from S3: ${key}`, err)
      }
    }

    for (const idx of indicesToExpunge) {
      this.send(session, `* ${idx} EXPUNGE`)
    }

    const remainingMessages = messages.filter((_, i) => !indicesToExpunge.includes(i + 1))
    this.setMessagesForFolder(session.email || '', folder, remainingMessages)

    if (indicesToExpunge.length > 0) {
      this.send(session, `* ${remainingMessages.length} EXISTS`)
    }

    this.send(session, `${tag} OK UID EXPUNGE completed`)
  }

  /**
   * Handle CLOSE command
   */
  private async handleClose(session: ImapSession, tag: string): Promise<void> {
    session.state = 'authenticated'
    session.selectedMailbox = undefined
    this.send(session, `${tag} OK CLOSE completed`)
  }

  /**
   * Handle EXPUNGE command
   */
  private async handleExpunge(session: ImapSession, tag: string): Promise<void> {
    if (session.state !== 'selected') {
      this.send(session, `${tag} NO Must select mailbox first`)
      return
    }

    const folder = session.selectedMailbox || 'INBOX'
    const messages = this.getMessagesForFolder(session.email || '', folder)
    const indicesToExpunge: number[] = []
    const keysToDelete: string[] = []

    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].flags.includes('\\Deleted')) {
        indicesToExpunge.push(i + 1)
        keysToDelete.push(messages[i].key)
      }
    }

    for (const key of keysToDelete) {
      try {
        await this.s3.deleteObject(this.config.bucket, key)
        console.log(`EXPUNGE: Deleted from S3: ${key}`)
      }
      catch (err) {
        console.error(`Failed to delete from S3: ${key}`, err)
      }
    }

    for (const idx of indicesToExpunge) {
      this.send(session, `* ${idx} EXPUNGE`)
    }

    const remainingMessages = messages.filter(m => !m.flags.includes('\\Deleted'))
    this.setMessagesForFolder(session.email || '', folder, remainingMessages)

    if (indicesToExpunge.length > 0) {
      this.send(session, `* ${remainingMessages.length} EXISTS`)
    }

    this.send(session, `${tag} OK EXPUNGE completed`)
  }

  /**
   * Handle IDLE command
   */
  private async handleIdle(session: ImapSession, tag: string): Promise<void> {
    session.idling = true
    session.idleTag = tag
    this.send(session, `+ idling`)
  }

  /**
   * Handle STARTTLS command
   */
  private async handleStartTls(session: ImapSession, tag: string): Promise<void> {
    if (!this.config.tls?.key || !this.config.tls?.cert) {
      this.send(session, `${tag} NO TLS not configured`)
      return
    }

    this.send(session, `${tag} OK Begin TLS negotiation`)

    const tlsOptions: tls.TlsOptions = {
      key: fs.readFileSync(this.config.tls.key),
      cert: fs.readFileSync(this.config.tls.cert),
      isServer: true,
    }

    const tlsSocket = new tls.TLSSocket(session.socket, tlsOptions)
    session.socket = tlsSocket as net.Socket
  }

  /**
   * Handle NAMESPACE command
   */
  private async handleNamespace(session: ImapSession, tag: string): Promise<void> {
    this.send(session, `* NAMESPACE (("" "/")) NIL NIL`)
    this.send(session, `${tag} OK NAMESPACE completed`)
  }

  /**
   * Handle XLIST command
   */
  private async handleXlist(session: ImapSession, tag: string, args: string): Promise<void> {
    if (session.state === 'not_authenticated') {
      this.send(session, `${tag} NO Must authenticate first`)
      return
    }

    const match = args.match(/^"?([^"]*)"?\s+"?([^"]*)"?$/)
    if (!match) {
      this.send(session, `${tag} BAD Invalid XLIST syntax`)
      return
    }

    const [, _reference, pattern] = match

    if (pattern === '*' || pattern === '%' || pattern === '') {
      this.send(session, `* XLIST (\\HasNoChildren \\Inbox) "/" "INBOX"`)
      this.send(session, `* XLIST (\\HasNoChildren \\Sent) "/" "Sent"`)
      this.send(session, `* XLIST (\\HasNoChildren \\Drafts) "/" "Drafts"`)
      this.send(session, `* XLIST (\\HasNoChildren \\Trash) "/" "Trash"`)
      this.send(session, `* XLIST (\\HasNoChildren \\Spam) "/" "Junk"`)
      this.send(session, `* XLIST (\\HasNoChildren \\AllMail) "/" "All Mail"`)
      this.send(session, `* XLIST (\\HasNoChildren) "/" "Archive"`)
    }

    this.send(session, `${tag} OK XLIST completed`)
  }

  /**
   * Handle CREATE command
   */
  private async handleCreate(session: ImapSession, tag: string, _args: string): Promise<void> {
    if (session.state === 'not_authenticated') {
      this.send(session, `${tag} NO Must authenticate first`)
      return
    }
    this.send(session, `${tag} OK CREATE completed`)
  }

  /**
   * Handle DELETE command
   */
  private async handleDelete(session: ImapSession, tag: string, args: string): Promise<void> {
    if (session.state === 'not_authenticated') {
      this.send(session, `${tag} NO Must authenticate first`)
      return
    }

    const mailbox = args.replace(/^"(.*)"$/, '$1').toUpperCase()
    const systemFolders = ['INBOX', 'SENT', 'DRAFTS', 'TRASH', 'JUNK', 'ARCHIVE', 'ALL MAIL']

    if (systemFolders.includes(mailbox)) {
      this.send(session, `${tag} NO Cannot delete system folder`)
      return
    }

    this.send(session, `${tag} OK DELETE completed`)
  }

  /**
   * Handle SUBSCRIBE command
   */
  private async handleSubscribe(session: ImapSession, tag: string, _args: string): Promise<void> {
    if (session.state === 'not_authenticated') {
      this.send(session, `${tag} NO Must authenticate first`)
      return
    }
    this.send(session, `${tag} OK SUBSCRIBE completed`)
  }

  /**
   * Handle UNSUBSCRIBE command
   */
  private async handleUnsubscribe(session: ImapSession, tag: string, _args: string): Promise<void> {
    if (session.state === 'not_authenticated') {
      this.send(session, `${tag} NO Must authenticate first`)
      return
    }
    this.send(session, `${tag} OK UNSUBSCRIBE completed`)
  }

  /**
   * Handle RENAME command
   */
  private async handleRename(session: ImapSession, tag: string, args: string): Promise<void> {
    if (session.state === 'not_authenticated') {
      this.send(session, `${tag} NO Must authenticate first`)
      return
    }

    const match = args.match(/^"?([^"\s]+)"?\s+"?([^"\s]+)"?$/)
    if (!match) {
      this.send(session, `${tag} BAD Invalid RENAME syntax`)
      return
    }

    const oldName = match[1].toUpperCase()
    const systemFolders = ['INBOX', 'SENT', 'DRAFTS', 'TRASH', 'JUNK', 'ARCHIVE', 'ALL MAIL']

    if (systemFolders.includes(oldName)) {
      this.send(session, `${tag} NO Cannot rename system folder`)
      return
    }

    this.send(session, `${tag} OK RENAME completed`)
  }

  /**
   * Handle APPEND command
   */
  private async handleAppend(session: ImapSession, tag: string, _args: string): Promise<void> {
    if (session.state === 'not_authenticated') {
      this.send(session, `${tag} NO Must authenticate first`)
      return
    }
    this.send(session, `${tag} OK APPEND completed`)
  }

  /**
   * Load messages from S3 for the selected folder
   */
  private async loadMessages(session: ImapSession, forceRefresh = false): Promise<void> {
    const email = session.email
    const folder = session.selectedMailbox || 'INBOX'
    if (!email)
      return

    const cacheKey = `${email}:${folder}`
    const lastUpdate = this.cacheTimestamp.get(cacheKey) || 0
    const now = Date.now()
    const cacheAge = now - lastUpdate

    if (!forceRefresh && cacheAge < this.CACHE_TTL_MS) {
      const cached = this.getMessagesForFolder(email, folder)
      if (cached.length > 0) {
        return
      }
    }

    const persistedFlags = await this.loadFlags(email)

    try {
      const prefix = this.getFolderPrefix(folder)

      const objects = await this.s3.list({
        bucket: this.config.bucket,
        prefix,
        maxKeys: 1000,
      })

      const messages: EmailMessage[] = []
      let uidCounter = this.getUidCounterForFolder(email, folder)

      for (const obj of objects) {
        if (!obj.Key)
          continue

        let raw = ''
        try {
          raw = await this.s3.getObject(this.config.bucket, obj.Key)
        }
        catch {
          continue
        }

        const headers = this.parseHeaders(raw)

        if (folder === 'INBOX') {
          const toHeader = headers.to || ''
          if (!toHeader.toLowerCase().includes(email.toLowerCase())) {
            continue
          }
        }

        uidCounter++

        const flags = persistedFlags[obj.Key] || ['\\Recent']

        messages.push({
          uid: uidCounter,
          key: obj.Key,
          size: obj.Size || raw.length,
          date: new Date(obj.LastModified || Date.now()),
          flags: [...flags],
          from: headers.from,
          to: headers.to,
          subject: headers.subject,
          raw,
        })
      }

      this.setUidCounterForFolder(email, folder, uidCounter)
      this.setMessagesForFolder(email, folder, messages)
      this.cacheTimestamp.set(cacheKey, Date.now())
      console.log(`Loaded ${messages.length} messages for ${email} in ${folder} from S3`)
    }
    catch (err) {
      console.error(`Error loading messages from S3: ${err}`)
    }
  }

  /**
   * Load messages from S3 for a specific folder (used by STATUS command)
   */
  private async loadMessagesForFolder(session: ImapSession, folder: string): Promise<void> {
    const email = session.email
    if (!email)
      return

    const cacheKey = `${email}:${folder}`
    const lastUpdate = this.cacheTimestamp.get(cacheKey) || 0
    const now = Date.now()
    const cacheAge = now - lastUpdate

    // Use cached data if fresh
    if (cacheAge < this.CACHE_TTL_MS) {
      const cached = this.getMessagesForFolder(email, folder)
      if (cached.length > 0) {
        return
      }
    }

    const persistedFlags = await this.loadFlags(email)

    try {
      const prefix = this.getFolderPrefix(folder)

      const objects = await this.s3.list({
        bucket: this.config.bucket,
        prefix,
        maxKeys: 1000,
      })

      const messages: EmailMessage[] = []
      let uidCounter = this.getUidCounterForFolder(email, folder)

      for (const obj of objects) {
        if (!obj.Key)
          continue

        let raw = ''
        try {
          raw = await this.s3.getObject(this.config.bucket, obj.Key)
        }
        catch {
          continue
        }

        const headers = this.parseHeaders(raw)

        // For INBOX, filter by recipient
        if (folder.toUpperCase() === 'INBOX') {
          const toHeader = headers.to || ''
          if (!toHeader.toLowerCase().includes(email.toLowerCase())) {
            continue
          }
        }

        uidCounter++

        const flags = persistedFlags[obj.Key] || ['\\Recent']

        messages.push({
          uid: uidCounter,
          key: obj.Key,
          size: obj.Size || raw.length,
          date: new Date(obj.LastModified || Date.now()),
          flags: [...flags],
          from: headers.from,
          to: headers.to,
          subject: headers.subject,
          raw,
        })
      }

      this.setUidCounterForFolder(email, folder, uidCounter)
      this.setMessagesForFolder(email, folder, messages)
      this.cacheTimestamp.set(cacheKey, Date.now())
    }
    catch (err) {
      console.error(`Error loading messages for folder ${folder}: ${err}`)
      // Set empty array so we don't return undefined
      this.setMessagesForFolder(email, folder, [])
    }
  }

  /**
   * Parse email headers
   */
  private parseHeaders(raw: string): Record<string, string> {
    const headers: Record<string, string> = {}
    const headerSection = raw.split('\r\n\r\n')[0] || raw.split('\n\n')[0] || ''

    const lines = headerSection.split(/\r?\n/)
    let currentHeader = ''
    let currentValue = ''

    for (const line of lines) {
      if (line.startsWith(' ') || line.startsWith('\t')) {
        currentValue += ` ${line.trim()}`
      }
      else {
        if (currentHeader) {
          headers[currentHeader.toLowerCase()] = currentValue
        }

        const colonIdx = line.indexOf(':')
        if (colonIdx > 0) {
          currentHeader = line.substring(0, colonIdx).trim()
          currentValue = line.substring(colonIdx + 1).trim()
        }
      }
    }

    if (currentHeader) {
      headers[currentHeader.toLowerCase()] = currentValue
    }

    return headers
  }

  /**
   * Build FETCH response
   */
  private async buildFetchResponse(
    session: ImapSession,
    msg: EmailMessage,
    _seqNum: number,
    itemsStr: string,
    includeUid = false,
  ): Promise<string> {
    const items = itemsStr.toUpperCase()
    const results: string[] = []

    if (includeUid || items.includes('UID')) {
      results.push(`UID ${msg.uid}`)
    }

    if (items.includes('FLAGS')) {
      results.push(`FLAGS (${msg.flags.join(' ')})`)
    }

    if (items.includes('RFC822.SIZE')) {
      results.push(`RFC822.SIZE ${msg.size}`)
    }

    if (items.includes('INTERNALDATE')) {
      results.push(`INTERNALDATE "${this.formatImapDate(msg.date)}"`)
    }

    if (items.includes('ENVELOPE')) {
      const envelope = this.buildEnvelope(msg)
      results.push(`ENVELOPE ${envelope}`)
    }

    if (items.includes('BODYSTRUCTURE') || items.includes('BODY.PEEK[STRUCTURE]')) {
      results.push(`BODYSTRUCTURE ("TEXT" "PLAIN" ("CHARSET" "UTF-8") NIL NIL "7BIT" ${msg.size} ${Math.ceil(msg.size / 80)} NIL NIL NIL)`)
    }

    if (items.includes('BODY[]') || items.includes('BODY.PEEK[]') || items.includes('RFC822')) {
      const raw = msg.raw || await this.s3.getObject(this.config.bucket, msg.key)
      results.push(`BODY[] {${raw.length}}\r\n${raw}`)
    }

    if (items.includes('BODY[HEADER]') || items.includes('BODY.PEEK[HEADER]')) {
      const raw = msg.raw || await this.s3.getObject(this.config.bucket, msg.key)
      const header = raw.split('\r\n\r\n')[0] || raw.split('\n\n')[0] || ''
      results.push(`BODY[HEADER] {${header.length + 2}}\r\n${header}\r\n`)
    }

    if (items.includes('BODY[TEXT]') || items.includes('BODY.PEEK[TEXT]')) {
      const raw = msg.raw || await this.s3.getObject(this.config.bucket, msg.key)
      const parts = raw.split('\r\n\r\n')
      const text = parts.slice(1).join('\r\n\r\n') || (raw.split('\n\n').slice(1).join('\n\n'))
      results.push(`BODY[TEXT] {${text.length}}\r\n${text}`)
    }

    return `(${results.join(' ')})`
  }

  /**
   * Build ENVELOPE response
   */
  private buildEnvelope(msg: EmailMessage): string {
    const quote = (s?: string) => s ? `"${s.replace(/"/g, '\\"')}"` : 'NIL'

    const date = quote(msg.date.toUTCString())
    const subject = quote(msg.subject)
    const from = msg.from ? `((NIL NIL "${msg.from.split('@')[0]}" "${msg.from.split('@')[1] || ''}"))` : 'NIL'
    const to = msg.to ? `((NIL NIL "${msg.to.split('@')[0]}" "${msg.to.split('@')[1] || ''}"))` : 'NIL'

    return `(${date} ${subject} ${from} ${from} ${from} ${to} NIL NIL NIL NIL)`
  }

  /**
   * Format date for IMAP
   */
  private formatImapDate(date: Date): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const d = date.getDate().toString().padStart(2, '0')
    const m = months[date.getMonth()]
    const y = date.getFullYear()
    const h = date.getHours().toString().padStart(2, '0')
    const min = date.getMinutes().toString().padStart(2, '0')
    const s = date.getSeconds().toString().padStart(2, '0')
    const tz = '+0000'
    return `${d}-${m}-${y} ${h}:${min}:${s} ${tz}`
  }

  /**
   * Parse IMAP sequence set
   */
  private parseSequenceSet(set: string, max: number): number[] {
    const results: number[] = []

    for (const part of set.split(',')) {
      if (part.includes(':')) {
        const [start, end] = part.split(':')
        const s = start === '*' ? max : Number.parseInt(start, 10)
        const e = end === '*' ? max : Number.parseInt(end, 10)
        for (let i = Math.min(s, e); i <= Math.max(s, e); i++) {
          if (i > 0 && i <= max) {
            results.push(i)
          }
        }
      }
      else {
        const n = part === '*' ? max : Number.parseInt(part, 10)
        if (n > 0 && n <= max) {
          results.push(n)
        }
      }
    }

    return [...new Set(results)].sort((a, b) => a - b)
  }

  /**
   * Get UID validity value for a mailbox
   */
  private getUidValidity(email: string): number {
    let hash = 0
    for (let i = 0; i < email.length; i++) {
      hash = ((hash << 5) - hash) + email.charCodeAt(i)
      hash = hash & hash
    }
    return Math.abs(hash) || 1
  }

  /**
   * Get the S3 prefix for a folder
   */
  private getFolderPrefix(folder: string): string {
    const normalizedFolder = folder.toUpperCase()
    switch (normalizedFolder) {
      case 'INBOX':
        return this.config.prefix || 'incoming/'
      case 'TRASH':
        return 'trash/'
      case 'SENT':
        return 'sent/'
      case 'DRAFTS':
        return 'drafts/'
      case 'JUNK':
        return 'junk/'
      case 'ARCHIVE':
        return 'archive/'
      default:
        return `folders/${folder.toLowerCase()}/`
    }
  }

  /**
   * Load flags from S3
   */
  private async loadFlags(email: string): Promise<Record<string, string[]>> {
    const cached = this.flagsCache.get(email)
    if (cached)
      return cached

    try {
      const flagsKey = `flags/${email.replace('@', '_at_')}.json`
      const content = await this.s3.getObject(this.config.bucket, flagsKey)
      const flags = JSON.parse(content)
      this.flagsCache.set(email, flags)
      return flags
    }
    catch {
      const empty: Record<string, string[]> = {}
      this.flagsCache.set(email, empty)
      return empty
    }
  }

  /**
   * Save flags to S3
   */
  private async saveFlags(email: string): Promise<void> {
    const flags = this.flagsCache.get(email)
    if (!flags)
      return

    try {
      const flagsKey = `flags/${email.replace('@', '_at_')}.json`
      await this.s3.putObject({
        bucket: this.config.bucket,
        key: flagsKey,
        body: JSON.stringify(flags),
        contentType: 'application/json',
      })
      console.log(`Saved flags for ${email}`)
    }
    catch (err) {
      console.error(`Failed to save flags for ${email}:`, err)
    }
  }

  /**
   * Get messages for a specific folder
   */
  private getMessagesForFolder(email: string, folder: string): EmailMessage[] {
    const userCache = this.messageCache.get(email)
    if (!userCache)
      return []
    return userCache.get(folder.toUpperCase()) || []
  }

  /**
   * Set messages for a specific folder
   */
  private setMessagesForFolder(email: string, folder: string, messages: EmailMessage[]): void {
    let userCache = this.messageCache.get(email)
    if (!userCache) {
      userCache = new Map()
      this.messageCache.set(email, userCache)
    }
    userCache.set(folder.toUpperCase(), messages)
  }

  /**
   * Get UID counter for a folder
   */
  private getUidCounterForFolder(email: string, folder: string): number {
    const userCounters = this.uidCounter.get(email)
    if (!userCounters)
      return 0
    return userCounters.get(folder.toUpperCase()) || 0
  }

  /**
   * Set UID counter for a folder
   */
  private setUidCounterForFolder(email: string, folder: string, value: number): void {
    let userCounters = this.uidCounter.get(email)
    if (!userCounters) {
      userCounters = new Map()
      this.uidCounter.set(email, userCounters)
    }
    userCounters.set(folder.toUpperCase(), value)
  }
}

/**
 * Create and start an IMAP server
 */
export async function startImapServer(config: ImapServerConfig): Promise<ImapServer> {
  const server = new ImapServer(config)
  await server.start()
  return server
}
