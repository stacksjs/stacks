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
import { S3Client } from './s3'

/**
 * Pattern configuration for a single email category
 */
export interface CategoryPatternConfig {
  domains?: string[]
  substrings?: string[]
  headers?: Record<string, string[]>
}

/**
 * Configuration for all email categories
 */
export interface CategorizationConfig {
  enabled?: boolean
  social?: CategoryPatternConfig
  forums?: CategoryPatternConfig
  updates?: CategoryPatternConfig
  promotions?: CategoryPatternConfig
}

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
  /**
   * Email categorization configuration.
   * When enabled, emails are automatically sorted into Social, Forums, Updates, Promotions folders.
   * You can customize the patterns or use the defaults from the stacks config.
   */
  categorization?: CategorizationConfig
}

/**
 * Email category types for automatic classification
 */
export type EmailCategory = 'social' | 'forums' | 'updates' | 'promotions' | 'primary'

/**
 * Known sender patterns for automatic email categorization
 * These patterns match common email senders to categorize emails like Gmail does
 */
export const CATEGORY_PATTERNS: Record<Exclude<EmailCategory, 'primary'>, {
  domains: string[]
  substrings: string[]
  headers?: Record<string, string[]>
}> = {
  // Social networks and social media platforms
  social: {
    domains: [
      'facebookmail.com', 'facebook.com', 'fb.com',
      'twitter.com', 'x.com',
      'linkedin.com', 'linkedinmail.com',
      'instagram.com',
      'tiktok.com',
      'snapchat.com',
      'pinterest.com',
      'reddit.com', 'redditmail.com',
      'tumblr.com',
      'discord.com', 'discordapp.com',
      'slack.com',
      'whatsapp.com',
      'telegram.org',
      'signal.org',
      'nextdoor.com',
      'meetup.com',
      'bumble.com', 'tinder.com', 'hinge.co',
      'strava.com',
      'twitch.tv',
      'mastodon.social',
      'threads.net',
      'bluesky.social',
    ],
    substrings: [
      'notification', 'noreply', 'no-reply',
      '@social.', '@notify.',
    ],
    headers: {
      'x-mailer': ['facebook', 'twitter', 'linkedin'],
    },
  },

  // Mailing lists, forums, and discussion groups
  forums: {
    domains: [
      'googlegroups.com', 'groups.google.com',
      'groups.io',
      'yahoogroups.com',
      'discourse.org',
      'mailman.', 'lists.',
      'freelists.org',
      'topica.com',
      'listserv.',
      'gaggle.email',
      'simplelists.com',
      'mailchimp.com', // when used for mailing lists
      'stackexchange.com', 'stackoverflow.com',
      'quora.com',
      'dev.to',
      'hackernews.com',
      'lobste.rs',
      'producthunt.com',
    ],
    substrings: [
      '-list@', '-users@', '-dev@', '-announce@',
      'mailing-list', 'mailinglist',
      'discussion@', 'forum@', 'community@',
      '@lists.', '@list.',
    ],
    headers: {
      'list-unsubscribe': [''], // Presence indicates mailing list
      'list-id': [''],
      'x-mailing-list': [''],
      'precedence': ['list', 'bulk'],
    },
  },

  // Transactional updates, notifications, confirmations
  updates: {
    domains: [
      // Development & DevOps
      'github.com', 'gitlab.com', 'bitbucket.org',
      'circleci.com', 'travis-ci.com',
      'vercel.com', 'netlify.com', 'heroku.com',
      'aws.amazon.com', 'amazonses.com',
      'cloud.google.com', 'azure.microsoft.com',
      'digitalocean.com', 'linode.com',
      'sentry.io', 'bugsnag.com',
      'datadog.com', 'newrelic.com',
      'pagerduty.com', 'opsgenie.com',
      'atlassian.com', 'jira.com',
      'notion.so', 'clickup.com', 'asana.com',
      'linear.app',

      // Finance & Banking
      'paypal.com', 'venmo.com', 'cashapp.com',
      'stripe.com', 'squareup.com',
      'intuit.com', 'quickbooks.com',
      'chase.com', 'wellsfargo.com', 'bankofamerica.com',
      'capitalone.com', 'citi.com', 'discover.com',
      'americanexpress.com', 'amex.com',

      // Shipping & Logistics
      'ups.com', 'fedex.com', 'usps.com', 'dhl.com',
      'amazon.com', // shipping notifications

      // Travel & Reservations
      'booking.com', 'airbnb.com', 'vrbo.com',
      'expedia.com', 'kayak.com', 'tripadvisor.com',
      'uber.com', 'lyft.com',
      'delta.com', 'united.com', 'aa.com', 'southwest.com',

      // Services & Subscriptions
      'apple.com', 'google.com', 'microsoft.com',
      'dropbox.com', 'box.com',
      'zoom.us', 'calendly.com',
      'docusign.com', 'hellosign.com',
    ],
    substrings: [
      'alert@', 'alerts@', 'notification@', 'notifications@',
      'update@', 'updates@', 'status@',
      'confirm@', 'confirmation@', 'receipt@',
      'invoice@', 'billing@', 'payment@',
      'security@', 'account@', 'verify@',
      'shipping@', 'delivery@', 'tracking@',
      'support@', 'help@', 'service@',
      'donotreply@', 'do-not-reply@', 'do_not_reply@',
      '@mail.', '@email.', '@e.', '@em.',
    ],
    headers: {
      'x-auto-response-suppress': [''],
      'auto-submitted': ['auto-generated', 'auto-replied'],
    },
  },

  // Marketing, promotional, and commercial emails
  promotions: {
    domains: [
      // Marketing platforms
      'mailchimp.com', 'sendgrid.net', 'sendgrid.com',
      'constantcontact.com', 'mailgun.org', 'mailgun.com',
      'mailjet.com', 'sendinblue.com', 'brevo.com',
      'hubspot.com', 'hubspotemail.net',
      'klaviyo.com', 'omnisend.com',
      'activecampaign.com', 'drip.com',
      'convertkit.com', 'aweber.com', 'getresponse.com',
      'campaignmonitor.com', 'createsend.com',
      'sailthru.com', 'iterable.com',
      'marketo.com', 'eloqua.com', 'pardot.com',

      // Retail & E-commerce
      'amazonses.com', 'amazon.com',
      'ebay.com', 'etsy.com',
      'walmart.com', 'target.com', 'bestbuy.com',
      'macys.com', 'nordstrom.com', 'kohls.com',
      'nike.com', 'adidas.com',
      'gap.com', 'oldnavy.com', 'zara.com', 'hm.com',
      'sephora.com', 'ulta.com',
      'wayfair.com', 'overstock.com',
      'homedepot.com', 'lowes.com',
      'costco.com', 'samsclub.com',

      // Food & Delivery
      'doordash.com', 'grubhub.com', 'ubereats.com',
      'postmates.com', 'instacart.com',
      'dominos.com', 'pizzahut.com', 'papajohns.com',
      'starbucks.com', 'dunkindonuts.com', 'chipotle.com',

      // Entertainment & Media
      'netflix.com', 'hulu.com', 'disneyplus.com',
      'hbomax.com', 'peacocktv.com', 'paramountplus.com',
      'spotify.com', 'apple.com',
      'audible.com', 'kindle.com',
      'ticketmaster.com', 'stubhub.com', 'eventbrite.com',

      // Deals & Coupons
      'groupon.com', 'livingsocial.com',
      'retailmenot.com', 'slickdeals.net',
      'honey.com', 'rakuten.com',
    ],
    substrings: [
      'promo@', 'promotions@', 'marketing@',
      'deals@', 'offers@', 'sale@', 'sales@',
      'newsletter@', 'news@', 'digest@',
      'shop@', 'store@', 'order@', 'orders@',
      'rewards@', 'loyalty@', 'members@',
      '@promo.', '@marketing.', '@deals.',
      '@offers.', '@shop.', '@store.',
      'unsubscribe', // presence in from/to often indicates marketing
    ],
    headers: {
      'x-campaign': [''],
      'x-mailchimp-': [''],
      'x-sg-': [''], // SendGrid
      'x-ses-': [''], // Amazon SES (often marketing)
    },
  },
}

/**
 * Merge custom patterns with defaults
 * @param defaults - Default patterns
 * @param custom - Custom patterns from config (if provided)
 * @returns Merged patterns
 */
function mergePatterns(
  defaults: typeof CATEGORY_PATTERNS,
  custom?: CategorizationConfig
): typeof CATEGORY_PATTERNS {
  if (!custom) return defaults

  const result = { ...defaults }

  for (const category of ['social', 'forums', 'updates', 'promotions'] as const) {
    const customCat = custom[category]
    if (customCat) {
      result[category] = {
        domains: customCat.domains || defaults[category].domains,
        substrings: customCat.substrings || defaults[category].substrings,
        headers: customCat.headers || defaults[category].headers,
      }
    }
  }

  return result
}

/**
 * Categorize an email based on sender patterns and headers
 * @param from - The From header value
 * @param headers - All email headers
 * @param customPatterns - Optional custom patterns from config
 * @returns The category for the email
 */
export function categorizeEmail(
  from: string,
  headers: Record<string, string>,
  customPatterns?: CategorizationConfig
): EmailCategory {
  const fromLower = from.toLowerCase()
  const patterns = mergePatterns(CATEGORY_PATTERNS, customPatterns)

  // Check each category's patterns
  for (const [category, categoryPatterns] of Object.entries(patterns)) {
    // Check domain patterns
    for (const domain of categoryPatterns.domains) {
      if (fromLower.includes(domain)) {
        return category as EmailCategory
      }
    }

    // Check substring patterns
    for (const substring of categoryPatterns.substrings) {
      if (fromLower.includes(substring)) {
        return category as EmailCategory
      }
    }

    // Check header patterns
    if (categoryPatterns.headers) {
      for (const [headerName, headerValues] of Object.entries(categoryPatterns.headers)) {
        const headerValue = headers[headerName.toLowerCase()] || ''
        if (headerValue) {
          // If headerValues is empty, presence of header is enough
          if (headerValues.length === 0 || headerValues[0] === '') {
            return category as EmailCategory
          }
          // Otherwise check if header value matches any pattern
          for (const value of headerValues) {
            if (headerValue.toLowerCase().includes(value.toLowerCase())) {
              return category as EmailCategory
            }
          }
        }
      }
    }
  }

  // Default to primary inbox if no patterns match
  return 'primary'
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

/**
 * IMAP Server that reads emails from S3
 */
export class ImapServer {
  private config: ImapServerConfig
  private s3: S3Client
  private server?: net.Server
  private tlsServer?: tls.Server
  private sessions: Map<string, ImapSession> = new Map()
  private messageCache: Map<string, Map<string, EmailMessage[]>> = new Map() // email -> folder -> messages
  private flagsCache: Map<string, Record<string, string[]>> = new Map() // email -> {s3Key: flags[]}
  private categorizedCache: Map<string, Set<string>> = new Map() // email -> set of already-categorized S3 keys
  private uidMappingCache: Map<string, Record<string, number>> = new Map() // email -> {s3Key: uid}
  private nextUidCache: Map<string, number> = new Map() // email -> nextUid
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
    this.s3 = new S3Client(config.region || 'us-east-1')
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
        // XLIST is deprecated Gmail extension but some clients use it
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
  private async handleAuthenticate(session: ImapSession, tag: string, args: string): Promise<void> {
    // For simplicity, reject AUTHENTICATE and require LOGIN
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
    // Same as SELECT but read-only
    await this.handleSelect(session, tag, args)
  }

  /**
   * Handle NOOP command - check for new messages
   */
  private async handleNoop(session: ImapSession, tag: string): Promise<void> {
    if (session.state === 'selected' && session.selectedMailbox === 'INBOX') {
      // Get old message count
      const oldMessages = this.messageCache.get(session.email || '') || []
      const oldCount = oldMessages.length

      // Force refresh to check for new messages
      await this.loadMessages(session, true)
      const newMessages = this.messageCache.get(session.email || '') || []
      const newCount = newMessages.length

      // Notify client of changes
      if (newCount !== oldCount) {
        this.send(session, `* ${newCount} EXISTS`)
        const recent = newMessages.filter(m => m.flags.includes('\\Recent')).length
        this.send(session, `* ${recent} RECENT`)
      }
    }
    this.send(session, `${tag} OK NOOP completed`)
  }

  /**
   * Handle CHECK command - request a checkpoint/sync
   */
  private async handleCheck(session: ImapSession, tag: string): Promise<void> {
    // CHECK requests a checkpoint, we use it to refresh the cache
    if (session.state === 'selected') {
      await this.loadMessages(session, true)
      const messages = this.messageCache.get(session.email || '') || []
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

    // Parse reference and pattern
    const match = args.match(/^"?([^"]*)"?\s+"?([^"]*)"?$/)
    if (!match) {
      this.send(session, `${tag} BAD Invalid LIST syntax`)
      return
    }

    const [, reference, pattern] = match

    // Return standard mailboxes with SPECIAL-USE attributes
    // These attributes help email clients identify folder purposes
    if (pattern === '*' || pattern === '%' || pattern === '') {
      // INBOX - main inbox
      this.send(session, `* LIST (\\HasNoChildren) "/" "INBOX"`)
      // Sent - sent messages
      this.send(session, `* LIST (\\HasNoChildren \\Sent) "/" "Sent"`)
      // Drafts - draft messages
      this.send(session, `* LIST (\\HasNoChildren \\Drafts) "/" "Drafts"`)
      // Trash - deleted messages
      this.send(session, `* LIST (\\HasNoChildren \\Trash) "/" "Trash"`)
      // Junk/Spam - spam messages
      this.send(session, `* LIST (\\HasNoChildren \\Junk) "/" "Junk"`)
      // Archive - archived messages
      this.send(session, `* LIST (\\HasNoChildren \\Archive) "/" "Archive"`)
      // All Mail - all messages (Gmail-style)
      this.send(session, `* LIST (\\HasNoChildren \\All) "/" "All Mail"`)
      // Starred - flagged/important messages (virtual folder)
      this.send(session, `* LIST (\\HasNoChildren \\Flagged) "/" "Starred"`)
      // Important - high priority messages (virtual folder)
      this.send(session, `* LIST (\\HasNoChildren \\Important) "/" "Important"`)

      // Gmail-style Categories (real folders with S3 storage)
      this.send(session, `* LIST (\\HasNoChildren) "/" "Social"`)
      this.send(session, `* LIST (\\HasNoChildren) "/" "Forums"`)
      this.send(session, `* LIST (\\HasNoChildren) "/" "Updates"`)
      this.send(session, `* LIST (\\HasNoChildren) "/" "Promotions"`)
    }
    else if (pattern.toUpperCase() === 'INBOX') {
      this.send(session, `* LIST (\\HasNoChildren) "/" "INBOX"`)
    }
    else {
      // Check for specific folder patterns
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
   * Handle LSUB command (subscribed folders)
   */
  private async handleLsub(session: ImapSession, tag: string, args: string): Promise<void> {
    if (session.state === 'not_authenticated') {
      this.send(session, `${tag} NO Must authenticate first`)
      return
    }

    // Parse reference and pattern
    const match = args.match(/^"?([^"]*)"?\s+"?([^"]*)"?$/)
    if (!match) {
      this.send(session, `${tag} BAD Invalid LSUB syntax`)
      return
    }

    const [, reference, pattern] = match

    // Return all folders as subscribed
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

    // Load messages for the requested mailbox
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

    // Parse sequence set and items
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
      const msg = messages[idx - 1] // 1-indexed
      if (!msg)
        continue

      const fetchData = await this.buildFetchResponse(session, msg, idx, itemsStr)
      this.send(session, `* ${idx} FETCH ${fetchData}`)
    }

    this.send(session, `${tag} OK FETCH completed`)
  }

  /**
   * Handle UID command (UID FETCH, UID SEARCH, etc.)
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

    // Parse UID set
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
  private async handleSearch(session: ImapSession, tag: string, args: string): Promise<void> {
    if (session.state !== 'selected') {
      this.send(session, `${tag} NO Must select mailbox first`)
      return
    }

    const folder = session.selectedMailbox || 'INBOX'
    const messages = this.getMessagesForFolder(session.email || '', folder)

    // Simple search - return all message sequence numbers
    if (messages.length === 0) {
      this.send(session, `* SEARCH`)
    } else {
      const results = messages.map((_, i) => i + 1)
      this.send(session, `* SEARCH ${results.join(' ')}`)
    }
    this.send(session, `${tag} OK SEARCH completed`)
  }

  /**
   * Handle UID SEARCH
   */
  private async handleUidSearch(session: ImapSession, tag: string, args: string): Promise<void> {
    const folder = session.selectedMailbox || 'INBOX'
    const messages = this.getMessagesForFolder(session.email || '', folder)

    // Simple UID search - return all UIDs
    if (messages.length === 0) {
      this.send(session, `* SEARCH`)
    } else {
      const results = messages.map(m => m.uid)
      this.send(session, `* SEARCH ${results.join(' ')}`)
    }
    this.send(session, `${tag} OK UID SEARCH completed`)
  }

  /**
   * Handle STORE command
   * STORE sequence-set flags-operation flags
   * Example: STORE 1 +FLAGS (\Deleted)
   */
  private async handleStore(session: ImapSession, tag: string, args: string): Promise<void> {
    if (session.state !== 'selected') {
      this.send(session, `${tag} NO Must select mailbox first`)
      return
    }

    // Parse: sequence-set flags-operation flags
    // Example: 1 +FLAGS (\Deleted)
    // Example: 1:* FLAGS.SILENT (\Seen)
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

    // Load persisted flags
    const persistedFlags = await this.loadFlags(session.email || '')

    // For each message, update flags and send FETCH response (unless SILENT)
    for (const idx of indices) {
      const msg = messages[idx - 1]
      if (!msg) continue

      // Update flags based on operation
      if (operation.startsWith('+')) {
        // Add flags
        for (const flag of flags) {
          if (!msg.flags.includes(flag)) {
            msg.flags.push(flag)
          }
        }
      } else if (operation.startsWith('-')) {
        // Remove flags
        msg.flags = msg.flags.filter(f => !flags.includes(f))
      } else {
        // Replace flags
        msg.flags = [...flags]
      }

      // Persist flags
      persistedFlags[msg.key] = [...msg.flags]

      // Send FETCH response unless SILENT
      if (!silent) {
        this.send(session, `* ${idx} FETCH (FLAGS (${msg.flags.join(' ')}))`)
      }
    }

    // Save flags to S3
    await this.saveFlags(session.email || '')

    this.send(session, `${tag} OK STORE completed`)
  }

  /**
   * Handle UID STORE
   * UID STORE uid-set flags-operation flags
   */
  private async handleUidStore(session: ImapSession, tag: string, args: string): Promise<void> {
    if (session.state !== 'selected') {
      this.send(session, `${tag} NO Must select mailbox first`)
      return
    }

    // Parse: uid-set flags-operation flags
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

    // Load persisted flags
    const persistedFlags = await this.loadFlags(session.email || '')

    // For each message, update flags and send FETCH response (unless SILENT)
    for (const uid of uids) {
      const idx = messages.findIndex(m => m.uid === uid)
      if (idx === -1) continue

      const msg = messages[idx]

      // Update flags based on operation
      if (operation.startsWith('+')) {
        // Add flags
        for (const flag of flags) {
          if (!msg.flags.includes(flag)) {
            msg.flags.push(flag)
          }
        }
      } else if (operation.startsWith('-')) {
        // Remove flags
        msg.flags = msg.flags.filter(f => !flags.includes(f))
      } else {
        // Replace flags
        msg.flags = [...flags]
      }

      // Persist flags
      persistedFlags[msg.key] = [...msg.flags]

      // Send FETCH response unless SILENT
      if (!silent) {
        this.send(session, `* ${idx + 1} FETCH (UID ${msg.uid} FLAGS (${msg.flags.join(' ')}))`)
      }
    }

    // Save flags to S3
    await this.saveFlags(session.email || '')

    this.send(session, `${tag} OK UID STORE completed`)
  }

  /**
   * Handle COPY command
   * COPY sequence-set mailbox
   */
  private async handleCopy(session: ImapSession, tag: string, args: string): Promise<void> {
    if (session.state !== 'selected') {
      this.send(session, `${tag} NO Must select mailbox first`)
      return
    }

    // Parse: sequence-set mailbox
    const match = args.match(/^(\S+)\s+"?([^"]+)"?$/i)
    if (!match) {
      this.send(session, `${tag} BAD Invalid COPY syntax`)
      return
    }

    const [, sequenceSet, destMailbox] = match
    const sourceFolder = session.selectedMailbox || 'INBOX'
    const messages = this.getMessagesForFolder(session.email || '', sourceFolder)
    const indices = this.parseSequenceSet(sequenceSet, messages.length)

    // Get destination folder S3 prefix
    const destPrefix = this.getFolderPrefix(destMailbox)

    // Copy messages to destination folder
    for (const idx of indices) {
      const msg = messages[idx - 1]
      if (!msg) continue

      try {
        // Get the message content
        const content = msg.raw || await this.s3.getObject(this.config.bucket, msg.key)

        // Generate new key for destination folder
        const filename = msg.key.split('/').pop() || `${Date.now()}`
        const newKey = `${destPrefix}${filename}`

        // Copy to destination
        await this.s3.putObject({
          bucket: this.config.bucket,
          key: newKey,
          body: content,
          contentType: 'message/rfc822',
        })

        console.log(`Copied message from ${msg.key} to ${newKey}`)
      } catch (err) {
        console.error(`Failed to copy message: ${err}`)
      }
    }

    this.send(session, `${tag} OK COPY completed`)
  }

  /**
   * Handle UID COPY
   * UID COPY uid-set mailbox
   */
  private async handleUidCopy(session: ImapSession, tag: string, args: string): Promise<void> {
    if (session.state !== 'selected') {
      this.send(session, `${tag} NO Must select mailbox first`)
      return
    }

    // Parse: uid-set mailbox
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

    // Get destination folder S3 prefix
    const destPrefix = this.getFolderPrefix(destMailbox)

    // Copy messages to destination folder
    for (const uid of uids) {
      const msg = messages.find(m => m.uid === uid)
      if (!msg) continue

      try {
        // Get the message content
        const content = msg.raw || await this.s3.getObject(this.config.bucket, msg.key)

        // Generate new key for destination folder
        const filename = msg.key.split('/').pop() || `${Date.now()}`
        const newKey = `${destPrefix}${filename}`

        // Copy to destination
        await this.s3.putObject({
          bucket: this.config.bucket,
          key: newKey,
          body: content,
          contentType: 'message/rfc822',
        })

        console.log(`UID COPY: Copied message from ${msg.key} to ${newKey}`)
      } catch (err) {
        console.error(`Failed to copy message: ${err}`)
      }
    }

    this.send(session, `${tag} OK UID COPY completed`)
  }

  /**
   * Handle MOVE command (RFC 6851)
   * MOVE sequence-set mailbox
   */
  private async handleMove(session: ImapSession, tag: string, args: string): Promise<void> {
    if (session.state !== 'selected') {
      this.send(session, `${tag} NO Must select mailbox first`)
      return
    }

    // Parse sequence set and destination mailbox
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

    // Copy messages to destination then delete from source
    for (const idx of indices) {
      const msg = messages[idx - 1]
      if (!msg) continue

      try {
        const content = msg.raw || await this.s3.getObject(this.config.bucket, msg.key)
        const filename = msg.key.split('/').pop() || `${Date.now()}`
        const newKey = `${destPrefix}${filename}`

        // Copy to destination
        await this.s3.putObject({
          bucket: this.config.bucket,
          key: newKey,
          body: content,
          contentType: 'message/rfc822',
        })

        // Delete from source
        await this.s3.deleteObject(this.config.bucket, msg.key)
        console.log(`MOVE: ${msg.key} -> ${newKey}`)
        movedIndices.push(idx)
      } catch (err) {
        console.error(`Failed to move message: ${err}`)
      }
    }

    // Send EXPUNGE responses for moved messages (in reverse order per RFC)
    const sortedIndices = [...movedIndices].sort((a, b) => b - a)
    for (const idx of sortedIndices) {
      this.send(session, `* ${idx} EXPUNGE`)
    }

    // Update cache
    const remainingMessages = messages.filter((_, i) => !movedIndices.includes(i + 1))
    this.setMessagesForFolder(session.email || '', sourceFolder, remainingMessages)

    // Update EXISTS count
    this.send(session, `* ${remainingMessages.length} EXISTS`)

    this.send(session, `${tag} OK MOVE completed`)
  }

  /**
   * Handle UID MOVE command (RFC 6851)
   * UID MOVE uid-set mailbox
   */
  private async handleUidMove(session: ImapSession, tag: string, args: string): Promise<void> {
    if (session.state !== 'selected') {
      this.send(session, `${tag} NO Must select mailbox first`)
      return
    }

    // Parse UID set and destination mailbox
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

    // Copy messages to destination then delete from source
    for (const uid of uids) {
      const idx = messages.findIndex(m => m.uid === uid)
      if (idx === -1) continue

      const msg = messages[idx]

      try {
        const content = msg.raw || await this.s3.getObject(this.config.bucket, msg.key)
        const filename = msg.key.split('/').pop() || `${Date.now()}`
        const newKey = `${destPrefix}${filename}`

        // Copy to destination
        await this.s3.putObject({
          bucket: this.config.bucket,
          key: newKey,
          body: content,
          contentType: 'message/rfc822',
        })

        // Delete from source
        await this.s3.deleteObject(this.config.bucket, msg.key)
        console.log(`UID MOVE: ${msg.key} -> ${newKey}`)
        movedIndices.push(idx + 1)
      } catch (err) {
        console.error(`Failed to move message: ${err}`)
      }
    }

    // Send EXPUNGE responses for moved messages (in reverse order per RFC)
    const sortedIndices = [...movedIndices].sort((a, b) => b - a)
    for (const idx of sortedIndices) {
      this.send(session, `* ${idx} EXPUNGE`)
    }

    // Update cache
    const remainingMessages = messages.filter((_, i) => !movedIndices.includes(i + 1))
    this.setMessagesForFolder(session.email || '', sourceFolder, remainingMessages)

    // Update EXISTS count
    this.send(session, `* ${remainingMessages.length} EXISTS`)

    this.send(session, `${tag} OK UID MOVE completed`)
  }

  /**
   * Handle UID EXPUNGE command (UIDPLUS extension)
   * UID EXPUNGE uid-set - expunges only specified UIDs
   */
  private async handleUidExpunge(session: ImapSession, tag: string, args: string): Promise<void> {
    if (session.state !== 'selected') {
      this.send(session, `${tag} NO Must select mailbox first`)
      return
    }

    const folder = session.selectedMailbox || 'INBOX'
    const messages = this.getMessagesForFolder(session.email || '', folder)

    // Parse UID set from args
    const uidSet = args.trim()
    const maxUid = messages.length > 0 ? Math.max(...messages.map(m => m.uid)) : 0
    const uids = this.parseSequenceSet(uidSet, maxUid)

    const indicesToExpunge: number[] = []
    const keysToDelete: string[] = []

    // Find messages with specified UIDs that are marked as \Deleted
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]
      if (uids.includes(msg.uid) && msg.flags.includes('\\Deleted')) {
        indicesToExpunge.push(i + 1) // 1-indexed
        keysToDelete.push(msg.key)
      }
    }

    // Delete from S3
    for (const key of keysToDelete) {
      try {
        await this.s3.deleteObject(this.config.bucket, key)
        console.log(`Deleted from S3: ${key}`)
      } catch (err) {
        console.error(`Failed to delete from S3: ${key}`, err)
      }
    }

    // Send EXPUNGE responses (already in reverse order)
    for (const idx of indicesToExpunge) {
      this.send(session, `* ${idx} EXPUNGE`)
    }

    // Remove deleted messages from cache
    const remainingMessages = messages.filter((_, i) => !indicesToExpunge.includes(i + 1))
    this.setMessagesForFolder(session.email || '', folder, remainingMessages)

    // Send EXISTS if messages were removed
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
   * Removes messages marked with \Deleted flag
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

    // Find messages marked with \Deleted (in reverse order for correct EXPUNGE responses)
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].flags.includes('\\Deleted')) {
        indicesToExpunge.push(i + 1) // 1-indexed
        keysToDelete.push(messages[i].key)
      }
    }

    // Delete from S3
    for (const key of keysToDelete) {
      try {
        await this.s3.deleteObject(this.config.bucket, key)
        console.log(`EXPUNGE: Deleted from S3: ${key}`)
      } catch (err) {
        console.error(`Failed to delete from S3: ${key}`, err)
      }
    }

    // Send EXPUNGE responses (already in reverse order)
    for (const idx of indicesToExpunge) {
      this.send(session, `* ${idx} EXPUNGE`)
    }

    // Remove deleted messages from cache
    const remainingMessages = messages.filter(m => !m.flags.includes('\\Deleted'))
    this.setMessagesForFolder(session.email || '', folder, remainingMessages)

    // Send EXISTS if messages were removed
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
    // Client will send DONE to exit IDLE state
    // When DONE is received, we'll send the OK response with the saved tag
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

    // Upgrade connection to TLS
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
   * Load messages from S3 for the selected folder
   */
  private async loadMessages(session: ImapSession, forceRefresh = false): Promise<void> {
    const email = session.email
    const folder = session.selectedMailbox || 'INBOX'
    if (!email)
      return

    // Check cache freshness
    const cacheKey = `${email}:${folder}`
    const lastUpdate = this.cacheTimestamp.get(cacheKey) || 0
    const now = Date.now()
    const cacheAge = now - lastUpdate

    // Use cache if fresh and not forcing refresh
    if (!forceRefresh && cacheAge < this.CACHE_TTL_MS) {
      const cached = this.getMessagesForFolder(email, folder)
      if (cached.length > 0) {
        return
      }
    }

    // Load persisted flags and UID mapping
    const persistedFlags = await this.loadFlags(email)
    await this.loadUidMapping(email)

    try {
      // Handle "All Mail" virtual folder - aggregate from all folders
      if (this.isAllMailFolder(folder)) {
        await this.loadAllMailFolder(email, persistedFlags)
        return
      }

      // Handle "Starred" virtual folder - shows flagged messages
      if (this.isStarredFolder(folder)) {
        await this.loadStarredFolder(email, persistedFlags)
        return
      }

      // Handle "Important" virtual folder - shows important messages
      if (this.isImportantFolder(folder)) {
        await this.loadImportantFolder(email, persistedFlags)
        return
      }

      // Determine S3 prefix for this folder
      const prefix = this.getFolderPrefix(folder)

      // List objects in S3
      const objects = await this.s3.list({
        bucket: this.config.bucket,
        prefix,
        maxKeys: 1000,
      })

      const messages: EmailMessage[] = []
      let hasNewMessages = false

      for (const obj of objects) {
        if (!obj.Key)
          continue

        // Parse email content to get headers
        let raw = ''
        try {
          raw = await this.s3.getObject(this.config.bucket, obj.Key)
        }
        catch {
          continue
        }

        // Parse basic headers
        const headers = this.parseHeaders(raw)

        // For INBOX, check if this email is for this user
        // For other folders, all messages in the prefix belong to the user
        if (folder === 'INBOX') {
          const toHeader = headers.to || ''
          if (!toHeader.toLowerCase().includes(email.toLowerCase())) {
            continue
          }

          // Auto-categorize new emails in INBOX
          if (this.config.autoCategorize) {
            await this.autoCategorizeEmail(email, obj.Key, headers.from || '', headers, raw)
          }
        }

        // Get or assign a persistent UID for this message
        const existingUid = this.uidMappingCache.get(email)?.[obj.Key]
        const uid = this.getOrAssignUid(email, obj.Key)
        if (!existingUid) {
          hasNewMessages = true
        }

        // Get persisted flags or use empty array for new messages (no \Recent by default)
        // Mail.app will show unread messages based on absence of \Seen flag
        const flags = persistedFlags[obj.Key] || []

        messages.push({
          uid,
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

      // Sort messages by UID (ascending) for correct sequence numbers
      messages.sort((a, b) => a.uid - b.uid)

      // Save UID mapping if new messages were added
      if (hasNewMessages) {
        await this.saveUidMapping(email)
      }

      // Update UID counter for folder to max UID
      const maxUid = messages.length > 0 ? Math.max(...messages.map(m => m.uid)) : 0
      this.setUidCounterForFolder(email, folder, maxUid)
      this.setMessagesForFolder(email, folder, messages)
      this.cacheTimestamp.set(cacheKey, Date.now())
      console.log(`Loaded ${messages.length} messages for ${email} in ${folder} from S3 (hasNewMessages=${hasNewMessages})`)
    }
    catch (err) {
      console.error(`Error loading messages from S3: ${err}`)
    }
  }

  /**
   * Load all messages from all folders for the "All Mail" virtual folder
   * Uses persistent UIDs for stable message identification across sessions
   */
  private async loadAllMailFolder(email: string, persistedFlags: Record<string, string[]>): Promise<void> {
    const folder = 'ALL MAIL'
    const cacheKey = `${email}:${folder}`

    // Load UID mapping for persistent UIDs
    await this.loadUidMapping(email)

    // All folder prefixes to aggregate
    const allPrefixes = [
      this.config.prefix || 'incoming/', // INBOX
      'sent/',
      'trash/',
      'drafts/',
      'junk/',
      'archive/',
    ]

    const allMessages: EmailMessage[] = []
    const seenKeys = new Set<string>() // Avoid duplicates
    let hasNewMessages = false

    for (const prefix of allPrefixes) {
      try {
        const objects = await this.s3.list({
          bucket: this.config.bucket,
          prefix,
          maxKeys: 1000,
        })

        for (const obj of objects) {
          if (!obj.Key || seenKeys.has(obj.Key))
            continue

          seenKeys.add(obj.Key)

          let raw = ''
          try {
            raw = await this.s3.getObject(this.config.bucket, obj.Key)
          }
          catch {
            continue
          }

          const headers = this.parseHeaders(raw)

          // For incoming (INBOX) folder, filter by recipient
          if (prefix === (this.config.prefix || 'incoming/')) {
            const toHeader = headers.to || ''
            if (!toHeader.toLowerCase().includes(email.toLowerCase())) {
              continue
            }
          }

          // Get or assign a persistent UID for this message
          const existingUid = this.uidMappingCache.get(email)?.[obj.Key]
          const uid = this.getOrAssignUid(email, obj.Key)
          if (!existingUid) {
            hasNewMessages = true
          }

          // Get persisted flags or use empty array for new messages
          const flags = persistedFlags[obj.Key] || []

          allMessages.push({
            uid,
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
      }
      catch (err) {
        console.error(`Error loading messages from prefix ${prefix}: ${err}`)
      }
    }

    // Sort messages by UID (ascending) for correct sequence numbers
    allMessages.sort((a, b) => a.uid - b.uid)

    // Save UID mapping if new messages were added
    if (hasNewMessages) {
      await this.saveUidMapping(email)
    }

    // Update UID counter for folder to max UID
    const maxUid = allMessages.length > 0 ? Math.max(...allMessages.map(m => m.uid)) : 0
    this.setUidCounterForFolder(email, folder, maxUid)
    this.setMessagesForFolder(email, folder, allMessages)
    this.cacheTimestamp.set(cacheKey, Date.now())
    console.log(`Loaded ${allMessages.length} total messages for ${email} in All Mail from S3 (hasNewMessages=${hasNewMessages})`)
  }

  /**
   * Load the Starred virtual folder - shows messages with \Flagged flag
   * Uses persistent UIDs for stable message identification across sessions
   */
  private async loadStarredFolder(email: string, persistedFlags: Record<string, string[]>): Promise<void> {
    const folder = 'STARRED'
    const cacheKey = `${email}:${folder}`

    // Load UID mapping for persistent UIDs
    await this.loadUidMapping(email)

    // All folder prefixes to search through
    const allPrefixes = [
      this.config.prefix || 'incoming/', // INBOX
      'sent/',
      'trash/',
      'drafts/',
      'junk/',
      'archive/',
      'categories/social/',
      'categories/forums/',
      'categories/updates/',
      'categories/promotions/',
    ]

    const starredMessages: EmailMessage[] = []
    const seenKeys = new Set<string>()
    let hasNewMessages = false

    for (const prefix of allPrefixes) {
      try {
        const objects = await this.s3.list({
          bucket: this.config.bucket,
          prefix,
          maxKeys: 1000,
        })

        for (const obj of objects) {
          if (!obj.Key || seenKeys.has(obj.Key))
            continue

          seenKeys.add(obj.Key)

          // Check if this message has the \Flagged flag
          const flags = persistedFlags[obj.Key] || []
          if (!flags.includes('\\Flagged'))
            continue

          let raw = ''
          try {
            raw = await this.s3.getObject(this.config.bucket, obj.Key)
          }
          catch {
            continue
          }

          const headers = this.parseHeaders(raw)

          // For incoming (INBOX) folder, filter by recipient
          if (prefix === (this.config.prefix || 'incoming/')) {
            const toHeader = headers.to || ''
            if (!toHeader.toLowerCase().includes(email.toLowerCase())) {
              continue
            }
          }

          // Get or assign a persistent UID for this message
          const existingUid = this.uidMappingCache.get(email)?.[obj.Key]
          const uid = this.getOrAssignUid(email, obj.Key)
          if (!existingUid) {
            hasNewMessages = true
          }

          starredMessages.push({
            uid,
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
      }
      catch (err) {
        console.error(`Error loading starred messages from prefix ${prefix}: ${err}`)
      }
    }

    // Sort messages by UID (ascending) for correct sequence numbers
    starredMessages.sort((a, b) => a.uid - b.uid)

    // Save UID mapping if new messages were added
    if (hasNewMessages) {
      await this.saveUidMapping(email)
    }

    // Update UID counter for folder to max UID
    const maxUid = starredMessages.length > 0 ? Math.max(...starredMessages.map(m => m.uid)) : 0
    this.setUidCounterForFolder(email, folder, maxUid)
    this.setMessagesForFolder(email, folder, starredMessages)
    this.cacheTimestamp.set(cacheKey, Date.now())
    console.log(`Loaded ${starredMessages.length} starred messages for ${email} (hasNewMessages=${hasNewMessages})`)
  }

  /**
   * Load the Important virtual folder - shows messages with \Important flag or $Important keyword
   * Uses persistent UIDs for stable message identification across sessions
   */
  private async loadImportantFolder(email: string, persistedFlags: Record<string, string[]>): Promise<void> {
    const folder = 'IMPORTANT'
    const cacheKey = `${email}:${folder}`

    // Load UID mapping for persistent UIDs
    await this.loadUidMapping(email)

    // All folder prefixes to search through
    const allPrefixes = [
      this.config.prefix || 'incoming/', // INBOX
      'sent/',
      'trash/',
      'drafts/',
      'junk/',
      'archive/',
      'categories/social/',
      'categories/forums/',
      'categories/updates/',
      'categories/promotions/',
    ]

    const importantMessages: EmailMessage[] = []
    const seenKeys = new Set<string>()
    let hasNewMessages = false

    for (const prefix of allPrefixes) {
      try {
        const objects = await this.s3.list({
          bucket: this.config.bucket,
          prefix,
          maxKeys: 1000,
        })

        for (const obj of objects) {
          if (!obj.Key || seenKeys.has(obj.Key))
            continue

          seenKeys.add(obj.Key)

          // Check if this message has the \Important flag or $Important keyword
          const flags = persistedFlags[obj.Key] || []
          const isImportant = flags.includes('\\Important') || flags.includes('$Important')
          if (!isImportant)
            continue

          let raw = ''
          try {
            raw = await this.s3.getObject(this.config.bucket, obj.Key)
          }
          catch {
            continue
          }

          const headers = this.parseHeaders(raw)

          // For incoming (INBOX) folder, filter by recipient
          if (prefix === (this.config.prefix || 'incoming/')) {
            const toHeader = headers.to || ''
            if (!toHeader.toLowerCase().includes(email.toLowerCase())) {
              continue
            }
          }

          // Get or assign a persistent UID for this message
          const existingUid = this.uidMappingCache.get(email)?.[obj.Key]
          const uid = this.getOrAssignUid(email, obj.Key)
          if (!existingUid) {
            hasNewMessages = true
          }

          importantMessages.push({
            uid,
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
      }
      catch (err) {
        console.error(`Error loading important messages from prefix ${prefix}: ${err}`)
      }
    }

    // Sort messages by UID (ascending) for correct sequence numbers
    importantMessages.sort((a, b) => a.uid - b.uid)

    // Save UID mapping if new messages were added
    if (hasNewMessages) {
      await this.saveUidMapping(email)
    }

    // Update UID counter for folder to max UID
    const maxUid = importantMessages.length > 0 ? Math.max(...importantMessages.map(m => m.uid)) : 0
    this.setUidCounterForFolder(email, folder, maxUid)
    this.setMessagesForFolder(email, folder, importantMessages)
    this.cacheTimestamp.set(cacheKey, Date.now())
    console.log(`Loaded ${importantMessages.length} important messages for ${email} (hasNewMessages=${hasNewMessages})`)
  }

  /**
   * Load messages from S3 for a specific folder (used by STATUS command)
   * Uses persistent UIDs for stable message identification across sessions
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
    await this.loadUidMapping(email)

    // Handle "All Mail" virtual folder - aggregate from all folders
    if (this.isAllMailFolder(folder)) {
      await this.loadAllMailFolder(email, persistedFlags)
      return
    }

    // Handle "Starred" virtual folder - shows flagged messages
    if (this.isStarredFolder(folder)) {
      await this.loadStarredFolder(email, persistedFlags)
      return
    }

    // Handle "Important" virtual folder - shows important messages
    if (this.isImportantFolder(folder)) {
      await this.loadImportantFolder(email, persistedFlags)
      return
    }

    try {
      const prefix = this.getFolderPrefix(folder)

      const objects = await this.s3.list({
        bucket: this.config.bucket,
        prefix,
        maxKeys: 1000,
      })

      const messages: EmailMessage[] = []
      let hasNewMessages = false

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

        // Get or assign a persistent UID for this message
        const existingUid = this.uidMappingCache.get(email)?.[obj.Key]
        const uid = this.getOrAssignUid(email, obj.Key)
        if (!existingUid) {
          hasNewMessages = true
        }

        // Get persisted flags or use empty array for new messages
        const flags = persistedFlags[obj.Key] || []

        messages.push({
          uid,
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

      // Sort messages by UID (ascending) for correct sequence numbers
      messages.sort((a, b) => a.uid - b.uid)

      // Save UID mapping if new messages were added
      if (hasNewMessages) {
        await this.saveUidMapping(email)
      }

      // Update UID counter for folder to max UID
      const maxUid = messages.length > 0 ? Math.max(...messages.map(m => m.uid)) : 0
      this.setUidCounterForFolder(email, folder, maxUid)
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
        // Continuation
        currentValue += ` ${line.trim()}`
      }
      else {
        // Save previous header
        if (currentHeader) {
          headers[currentHeader.toLowerCase()] = currentValue
        }

        // Parse new header
        const colonIdx = line.indexOf(':')
        if (colonIdx > 0) {
          currentHeader = line.substring(0, colonIdx).trim()
          currentValue = line.substring(colonIdx + 1).trim()
        }
      }
    }

    // Save last header
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
    seqNum: number,
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
   * Parse IMAP sequence set (e.g., "1:*", "1,3,5", "1:10")
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
    // Use a hash of the email to generate a stable UID validity
    let hash = 0
    for (let i = 0; i < email.length; i++) {
      hash = ((hash << 5) - hash) + email.charCodeAt(i)
      hash = hash & hash // Convert to 32-bit integer
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
      case 'ALL MAIL':
        return '' // All Mail is a virtual folder - handled specially
      case 'STARRED':
        return '' // Starred is a virtual folder - shows flagged messages
      case 'IMPORTANT':
        return '' // Important is a virtual folder - shows important messages
      // Gmail-style Categories
      case 'SOCIAL':
        return 'categories/social/'
      case 'FORUMS':
        return 'categories/forums/'
      case 'UPDATES':
        return 'categories/updates/'
      case 'PROMOTIONS':
        return 'categories/promotions/'
      default:
        return `folders/${folder.toLowerCase()}/`
    }
  }

  /**
   * Check if a folder is a virtual folder (computed from flags, not S3 storage)
   */
  private isVirtualFolder(folder: string): boolean {
    const virtualFolders = ['ALL MAIL', 'STARRED', 'IMPORTANT']
    return virtualFolders.includes(folder.toUpperCase())
  }

  /**
   * Check if a folder is the Starred folder (shows flagged messages)
   */
  private isStarredFolder(folder: string): boolean {
    return folder.toUpperCase() === 'STARRED'
  }

  /**
   * Check if a folder is the Important folder
   */
  private isImportantFolder(folder: string): boolean {
    return folder.toUpperCase() === 'IMPORTANT'
  }

  /**
   * Check if a folder is the virtual "All Mail" folder
   */
  private isAllMailFolder(folder: string): boolean {
    return folder.toUpperCase() === 'ALL MAIL'
  }

  /**
   * Auto-categorize an email and copy to the appropriate category folder
   * This mimics Gmail's automatic inbox categorization
   * @param email - User's email address
   * @param s3Key - S3 key of the email
   * @param from - From header value
   * @param headers - All email headers
   * @param raw - Raw email content
   * @returns The category the email was assigned to, or 'primary' if not categorized
   */
  private async autoCategorizeEmail(
    email: string,
    s3Key: string,
    from: string,
    headers: Record<string, string>,
    raw: string
  ): Promise<EmailCategory> {
    // Skip if auto-categorization is disabled
    if (!this.config.autoCategorize) {
      return 'primary'
    }

    // Get or create the set of already-categorized keys for this user
    let categorizedKeys = this.categorizedCache.get(email)
    if (!categorizedKeys) {
      // Load from S3 on first access
      categorizedKeys = await this.loadCategorizedKeys(email)
      this.categorizedCache.set(email, categorizedKeys)
    }

    // Skip if already categorized
    if (categorizedKeys.has(s3Key)) {
      return 'primary'
    }

    // Categorize the email using config-provided patterns
    const category = categorizeEmail(from, headers, this.config.categorization)

    // If it's a category folder, copy the email there
    if (category !== 'primary') {
      const destPrefix = this.getCategoryPrefix(category)
      const filename = s3Key.split('/').pop() || `${Date.now()}`
      const newKey = `${destPrefix}${filename}`

      try {
        // Copy to category folder
        await this.s3.putObject({
          bucket: this.config.bucket,
          key: newKey,
          body: raw,
          contentType: 'message/rfc822',
        })
        console.log(`Auto-categorized ${s3Key} -> ${category} (${newKey})`)

        // Mark as categorized
        categorizedKeys.add(s3Key)
        await this.saveCategorizedKeys(email)
      } catch (err) {
        console.error(`Failed to auto-categorize email to ${category}:`, err)
      }
    }

    return category
  }

  /**
   * Get the S3 prefix for a category folder
   */
  private getCategoryPrefix(category: EmailCategory): string {
    switch (category) {
      case 'social':
        return 'categories/social/'
      case 'forums':
        return 'categories/forums/'
      case 'updates':
        return 'categories/updates/'
      case 'promotions':
        return 'categories/promotions/'
      default:
        return this.config.prefix || 'incoming/'
    }
  }

  /**
   * Load the set of already-categorized S3 keys from S3
   */
  private async loadCategorizedKeys(email: string): Promise<Set<string>> {
    try {
      const key = `categorized/${email.replace('@', '_at_')}.json`
      const content = await this.s3.getObject(this.config.bucket, key)
      const data = JSON.parse(content)
      return new Set(data.keys || [])
    } catch {
      return new Set()
    }
  }

  /**
   * Save the set of categorized S3 keys to S3
   */
  private async saveCategorizedKeys(email: string): Promise<void> {
    const categorizedKeys = this.categorizedCache.get(email)
    if (!categorizedKeys) return

    try {
      const key = `categorized/${email.replace('@', '_at_')}.json`
      await this.s3.putObject({
        bucket: this.config.bucket,
        key,
        body: JSON.stringify({ keys: Array.from(categorizedKeys) }),
        contentType: 'application/json',
      })
    } catch (err) {
      console.error(`Failed to save categorized keys for ${email}:`, err)
    }
  }

  /**
   * Load flags from S3
   */
  private async loadFlags(email: string): Promise<Record<string, string[]>> {
    const cached = this.flagsCache.get(email)
    if (cached) return cached

    try {
      const flagsKey = `flags/${email.replace('@', '_at_')}.json`
      const content = await this.s3.getObject(this.config.bucket, flagsKey)
      const flags = JSON.parse(content)
      this.flagsCache.set(email, flags)
      return flags
    } catch {
      // No flags file yet
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
    if (!flags) return

    try {
      const flagsKey = `flags/${email.replace('@', '_at_')}.json`
      await this.s3.putObject({
        bucket: this.config.bucket,
        key: flagsKey,
        body: JSON.stringify(flags),
        contentType: 'application/json',
      })
      console.log(`Saved flags for ${email}`)
    } catch (err) {
      console.error(`Failed to save flags for ${email}:`, err)
    }
  }

  /**
   * Load UID mapping from S3 (maps S3 keys to persistent UIDs)
   */
  private async loadUidMapping(email: string): Promise<{ mapping: Record<string, number>, nextUid: number }> {
    const cached = this.uidMappingCache.get(email)
    const nextUid = this.nextUidCache.get(email)
    if (cached && nextUid !== undefined) {
      return { mapping: cached, nextUid }
    }

    try {
      const uidKey = `uids/${email.replace('@', '_at_')}.json`
      const content = await this.s3.getObject(this.config.bucket, uidKey)
      const data = JSON.parse(content)
      const mapping = data.mapping || {}
      const loadedNextUid = data.nextUid || 1
      this.uidMappingCache.set(email, mapping)
      this.nextUidCache.set(email, loadedNextUid)
      return { mapping, nextUid: loadedNextUid }
    } catch {
      // No UID mapping file yet
      const empty: Record<string, number> = {}
      this.uidMappingCache.set(email, empty)
      this.nextUidCache.set(email, 1)
      return { mapping: empty, nextUid: 1 }
    }
  }

  /**
   * Save UID mapping to S3
   */
  private async saveUidMapping(email: string): Promise<void> {
    const mapping = this.uidMappingCache.get(email)
    const nextUid = this.nextUidCache.get(email)
    if (!mapping) return

    try {
      const uidKey = `uids/${email.replace('@', '_at_')}.json`
      await this.s3.putObject({
        bucket: this.config.bucket,
        key: uidKey,
        body: JSON.stringify({ mapping, nextUid }),
        contentType: 'application/json',
      })
    } catch (err) {
      console.error(`Failed to save UID mapping for ${email}:`, err)
    }
  }

  /**
   * Get or assign a UID for a message (S3 key)
   * Returns existing UID if message was seen before, assigns new UID otherwise
   */
  private getOrAssignUid(email: string, s3Key: string): number {
    let mapping = this.uidMappingCache.get(email)
    if (!mapping) {
      mapping = {}
      this.uidMappingCache.set(email, mapping)
    }

    // Return existing UID if message was seen before
    if (mapping[s3Key]) {
      return mapping[s3Key]
    }

    // Assign new UID
    let nextUid = this.nextUidCache.get(email) || 1
    mapping[s3Key] = nextUid
    nextUid++
    this.nextUidCache.set(email, nextUid)

    return mapping[s3Key]
  }

  /**
   * Get messages for a specific folder
   */
  private getMessagesForFolder(email: string, folder: string): EmailMessage[] {
    const userCache = this.messageCache.get(email)
    if (!userCache) return []
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
    if (!userCounters) return 0
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

  /**
   * Handle XLIST command (deprecated Gmail extension, but some clients use it)
   */
  private async handleXlist(session: ImapSession, tag: string, args: string): Promise<void> {
    if (session.state === 'not_authenticated') {
      this.send(session, `${tag} NO Must authenticate first`)
      return
    }

    // Parse reference and pattern
    const match = args.match(/^"?([^"]*)"?\s+"?([^"]*)"?$/)
    if (!match) {
      this.send(session, `${tag} BAD Invalid XLIST syntax`)
      return
    }

    const [, reference, pattern] = match

    // Return folders with Gmail-style XLIST attributes
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
  private async handleCreate(session: ImapSession, tag: string, args: string): Promise<void> {
    if (session.state === 'not_authenticated') {
      this.send(session, `${tag} NO Must authenticate first`)
      return
    }

    // For now, acknowledge but don't actually create (S3 doesn't have true folders)
    const mailbox = args.replace(/^"(.*)"$/, '$1')
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

    // Don't allow deleting system folders
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
  private async handleSubscribe(session: ImapSession, tag: string, args: string): Promise<void> {
    if (session.state === 'not_authenticated') {
      this.send(session, `${tag} NO Must authenticate first`)
      return
    }

    this.send(session, `${tag} OK SUBSCRIBE completed`)
  }

  /**
   * Handle UNSUBSCRIBE command
   */
  private async handleUnsubscribe(session: ImapSession, tag: string, args: string): Promise<void> {
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

    // Don't allow renaming system folders
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
  private async handleAppend(session: ImapSession, tag: string, args: string): Promise<void> {
    if (session.state === 'not_authenticated') {
      this.send(session, `${tag} NO Must authenticate first`)
      return
    }

    // APPEND adds a message to a mailbox
    // For now, acknowledge but don't persist (would need S3 write)
    this.send(session, `${tag} OK APPEND completed`)
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
