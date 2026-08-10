/**
 * Email SDK for Stacks Applications
 *
 * Provides programmatic access to email functionality:
 * - Send emails
 * - Get inbox emails
 * - Search emails
 * - Delete emails
 */

import { email as emailConfig } from '@stacksjs/config'
import { getErrorMessage } from '@stacksjs/utils'
import { normalizeEmailHtmlBody, normalizeEmailTextBody } from '../mime-preview'
import {
  type InboxAttachment,
  inboxAttachmentPrefix,
  mapInboxAttachmentObjects,
} from './inbox-attachments'

export * from './inbox-attachments'

export interface EmailAddress {
  name?: string
  address: string
}

export interface EmailMessage {
  from?: EmailAddress | string
  to: string | string[] | EmailAddress[]
  cc?: string | string[] | EmailAddress[]
  bcc?: string | string[] | EmailAddress[]
  replyTo?: string | EmailAddress
  subject: string
  text?: string
  html?: string
  attachments?: EmailAttachment[]
}

export interface EmailAttachment {
  filename: string
  content: string | Buffer
  contentType?: string
  encoding?: 'base64' | 'binary'
}

export interface InboxEmail {
  messageId: string
  from: string
  fromName?: string
  to: string
  subject: string
  date: string
  read: boolean
  preview?: string
  hasAttachments?: boolean
  path: string
}

export interface InboxStats {
  total: number
  unread: number
  read: number
}

export interface EmailSearchOptions {
  from?: string
  to?: string
  subject?: string
  after?: Date
  before?: Date
  hasAttachments?: boolean
  limit?: number
  offset?: number
}

export interface SendResult {
  success: boolean
  messageId?: string
  error?: string
}

export type EmailStorageClient = Pick<import('@stacksjs/ts-cloud').S3Client,
  'deleteObjects' | 'getObject' | 'getObjectBytes' | 'listObjects' | 'putObject'>

export interface EmailSDKOptions {
  bucket?: string
  region?: string
  domain?: string
  storage?: () => EmailStorageClient | Promise<EmailStorageClient>
}

/**
 * Email SDK class for Stacks applications
 */
export class EmailSDK {
  private bucket: string
  private region: string
  private domain: string
  private storageFactory?: EmailSDKOptions['storage']

  constructor(options?: EmailSDKOptions) {
    const appName = (process.env.APP_NAME || 'stacks').toLowerCase().replace(/[^a-z0-9-]/g, '-')
    this.bucket = options?.bucket || process.env.AWS_BUCKET || `${appName}-production-email`
    this.region = options?.region || process.env.AWS_REGION || 'us-east-1'
    const fromAddress = emailConfig?.from?.address
    const parsedDomain = fromAddress?.includes('@') ? fromAddress.split('@')[1] : undefined
    this.domain = options?.domain || parsedDomain || 'stacksjs.com'
    this.storageFactory = options?.storage
  }

  /**
   * Send an email
   */
  async send(message: EmailMessage): Promise<SendResult> {
    try {
      const { SESClient } = await import('@stacksjs/ts-cloud')
      const ses = new SESClient(this.region)

      // Normalize from address
      const from = this.normalizeAddress(message.from || emailConfig?.from || { address: `noreply@${this.domain}` })

      // Normalize recipients
      const toAddresses = this.normalizeAddresses(message.to)
      const ccAddresses = message.cc ? this.normalizeAddresses(message.cc) : undefined
      const bccAddresses = message.bcc ? this.normalizeAddresses(message.bcc) : undefined

      const result = await ses.sendEmail({
        FromEmailAddress: typeof from === 'string' ? from : `${from.name} <${from.address}>`,
        Destination: {
          ToAddresses: toAddresses,
          CcAddresses: ccAddresses,
          BccAddresses: bccAddresses,
        },
        ReplyToAddresses: message.replyTo
          ? [typeof message.replyTo === 'string' ? message.replyTo : message.replyTo.address]
          : undefined,
        Content: {
          Simple: {
            Subject: {
              Data: message.subject,
              Charset: 'UTF-8',
            },
            Body: {
              ...(message.html && {
                Html: {
                  Data: message.html,
                  Charset: 'UTF-8',
                },
              }),
              ...(message.text && {
                Text: {
                  Data: message.text,
                  Charset: 'UTF-8',
                },
              }),
            },
          },
        },
      })

      return {
        success: true,
        messageId: result.MessageId,
      }
    }
    catch (error: unknown) {
      return {
        success: false,
        error: getErrorMessage(error),
      }
    }
  }

  /**
   * Send a templated email
   */
  async sendTemplate(options: {
    to: string | string[]
    template: string
    data: Record<string, any>
    from?: EmailAddress | string
    subject?: string
  }): Promise<SendResult> {
    // For now, just render the template and send
    // In the future, this could use SES templates
    const html = this.renderTemplate(options.template, options.data)
    const subject = options.subject || options.template

    return this.send({
      to: options.to,
      from: options.from,
      subject,
      html,
    })
  }

  /**
   * Get inbox emails for a mailbox
   */
  async getInbox(mailbox: string, options?: { limit?: number; offset?: number }): Promise<InboxEmail[]> {
    try {
      const s3 = await this.storage()

      const [localPart, domain] = mailbox.includes('@') ? mailbox.split('@') : [mailbox, this.domain]

      const indexKey = `mailboxes/${domain}/${localPart}/inbox.json`

      const result = await s3.getObject(this.bucket, indexKey)

      if (!result) {
        return []
      }

      let inbox: InboxEmail[] = JSON.parse(result) as InboxEmail[]

      // Apply pagination
      const offset = options?.offset || 0
      const limit = options?.limit || 50

      return inbox.slice(offset, offset + limit)
    }
    catch (error: unknown) {
      if (getErrorMessage(error).includes('NoSuchKey') || getErrorMessage(error).includes('404')) {
        return []
      }
      throw error
    }
  }

  /**
   * Get aggregate inbox statistics for a mailbox
   */
  async getInboxStats(mailbox: string): Promise<InboxStats> {
    const inbox = await this.getInbox(mailbox, { limit: 1000 })
    const unread = inbox.filter(e => !e.read).length
    return {
      total: inbox.length,
      unread,
      read: inbox.length - unread,
    }
  }

  /**
   * Get the number of unread messages in a mailbox
   */
  async getUnreadCount(mailbox: string): Promise<number> {
    const stats = await this.getInboxStats(mailbox)
    return stats.unread
  }

  /**
   * Get a specific email
   */
  async getEmail(mailbox: string, messageId: string): Promise<{
    metadata: Record<string, any>
    html?: string
    text?: string
    raw?: string
    attachments: InboxAttachment[]
  } | null> {
    try {
      const s3 = await this.storage()

      // First get the inbox to find the email path
      const inbox = await this.getInbox(mailbox, { limit: 1000 })
      const email = inbox.find(e => e.messageId === messageId)

      if (!email) {
        return null
      }

      const basePath = email.path

      // Get metadata
      const metaResult = await s3.getObject(this.bucket, `${basePath}/metadata.json`)
      let metadata: Record<string, unknown> = {}
      if (metaResult) {
        try {
          metadata = JSON.parse(metaResult) as Record<string, unknown>
        }
        catch (parseError: any) {
          console.debug(`[email-sdk] Failed to parse email metadata: ${parseError.message}`)
        }
      }

      // Try to get HTML body
      let html: string | undefined
      try {
        const htmlResult = await s3.getObject(this.bucket, `${basePath}/body.html`)
        html = htmlResult ? normalizeEmailHtmlBody(htmlResult) : undefined
      }
      catch (error: unknown) {
        // Expected when email has no HTML version (NoSuchKey)
        if (!getErrorMessage(error)?.includes('NoSuchKey') && !getErrorMessage(error)?.includes('404')) {
          console.debug(`[email-sdk] Failed to fetch HTML body: ${getErrorMessage(error)}`)
        }
      }

      // Try to get text body
      let text: string | undefined
      try {
        const textResult = await s3.getObject(this.bucket, `${basePath}/body.txt`)
        text = textResult ? normalizeEmailTextBody(textResult) : undefined
      }
      catch (error: unknown) {
        // Expected when email has no text version (NoSuchKey)
        if (!getErrorMessage(error)?.includes('NoSuchKey') && !getErrorMessage(error)?.includes('404')) {
          console.debug(`[email-sdk] Failed to fetch text body: ${getErrorMessage(error)}`)
        }
      }

      const attachments = await this.listAttachments(s3, email)

      return { metadata, html, text, attachments }
    }
    catch (error: unknown) {
      if (getErrorMessage(error).includes('NoSuchKey') || getErrorMessage(error).includes('404')) {
        return null
      }
      throw error
    }
  }

  /**
   * List the downloadable attachments stored for an inbox email.
   */
  async getAttachments(mailbox: string, messageId: string): Promise<InboxAttachment[] | null> {
    const inbox = await this.getInbox(mailbox, { limit: 1000 })
    const email = inbox.find(entry => entry.messageId === messageId)

    if (!email)
      return null

    return this.listAttachments(await this.storage(), email)
  }

  /**
   * Read one attachment by its opaque SDK identifier. The identifier is matched
   * against the mailbox's stored objects before any bytes are fetched, so a
   * request can never select an arbitrary S3 key.
   */
  async getAttachment(mailbox: string, messageId: string, attachmentId: string): Promise<{
    attachment: InboxAttachment
    body: Uint8Array
    contentType: string
  } | null> {
    const s3 = await this.storage()
    const inbox = await this.getInbox(mailbox, { limit: 1000 })
    const email = inbox.find(entry => entry.messageId === messageId)

    if (!email)
      return null

    const stored = await this.listStoredAttachments(s3, email)
    const attachment = stored.find(item => item.id === attachmentId)
    if (!attachment)
      return null

    const result = await s3.getObjectBytes(this.bucket, attachment.key)
    return {
      attachment: {
        id: attachment.id,
        name: attachment.name,
        size: attachment.size || result.contentLength || result.body.byteLength,
        ...(attachment.lastModified ? { lastModified: attachment.lastModified } : {}),
      },
      body: result.body,
      contentType: result.contentType || 'application/octet-stream',
    }
  }

  /**
   * Search emails
   */
  async search(mailbox: string, options: EmailSearchOptions): Promise<InboxEmail[]> {
    const inbox = await this.getInbox(mailbox, { limit: 1000 })

    let results = inbox

    if (options.from) {
      const fromLower = options.from.toLowerCase()
      results = results.filter(e => e.from.toLowerCase().includes(fromLower))
    }

    if (options.subject) {
      const subjectLower = options.subject.toLowerCase()
      results = results.filter(e => e.subject.toLowerCase().includes(subjectLower))
    }

    if (options.after) {
      results = results.filter(e => new Date(e.date) >= options.after!)
    }

    if (options.before) {
      results = results.filter(e => new Date(e.date) <= options.before!)
    }

    if (options.hasAttachments !== undefined) {
      results = results.filter(e => e.hasAttachments === options.hasAttachments)
    }

    // Apply pagination
    const offset = options.offset || 0
    const limit = options.limit || 50

    return results.slice(offset, offset + limit)
  }

  /**
   * Delete an email
   */
  async delete(mailbox: string, messageId: string): Promise<boolean> {
    const s3 = await this.storage()

    const [localPart, domain] = mailbox.includes('@') ? mailbox.split('@') : [mailbox, this.domain]

    // Get inbox and find the email
    const inbox = await this.getInbox(mailbox, { limit: 1000 })
    const emailIndex = inbox.findIndex(e => e.messageId === messageId)

    if (emailIndex === -1) {
      return false
    }

    const email = inbox[emailIndex]
    if (!email)
      return false

    const basePath = email.path
    const keysToDelete = await this.listStoredObjectKeys(s3, `${basePath}/`)
    for (let offset = 0; offset < keysToDelete.length; offset += 1000)
      await s3.deleteObjects(this.bucket, keysToDelete.slice(offset, offset + 1000))

    // Update inbox index only after every stored object was removed.
    inbox.splice(emailIndex, 1)

    await s3.putObject({
      bucket: this.bucket,
      key: `mailboxes/${domain}/${localPart}/inbox.json`,
      body: JSON.stringify(inbox, null, 2),
      contentType: 'application/json',
    })

    return true
  }

  private async listAttachments(s3: EmailStorageClient, email: InboxEmail): Promise<InboxAttachment[]> {
    const attachments = await this.listStoredAttachments(s3, email)
    return attachments.map(attachment => ({
      id: attachment.id,
      name: attachment.name,
      size: attachment.size,
      ...(attachment.lastModified ? { lastModified: attachment.lastModified } : {}),
    }))
  }

  private async listStoredAttachments(s3: EmailStorageClient, email: InboxEmail) {
    const result = await s3.listObjects({
      bucket: this.bucket,
      prefix: inboxAttachmentPrefix(email.path),
      maxKeys: 1000,
    })

    return mapInboxAttachmentObjects(email.path, result.objects)
  }

  private async listStoredObjectKeys(s3: EmailStorageClient, prefix: string): Promise<string[]> {
    const keys: string[] = []
    let continuationToken: string | undefined

    do {
      const result = await s3.listObjects({
        bucket: this.bucket,
        prefix,
        maxKeys: 1000,
        ...(continuationToken ? { continuationToken } : {}),
      })
      keys.push(...result.objects.map(object => object.Key).filter(Boolean))
      continuationToken = result.nextContinuationToken
    } while (continuationToken)

    return keys
  }

  /**
   * Mark email as read
   */
  async markAsRead(mailbox: string, messageId: string): Promise<boolean> {
    return this.updateEmailStatus(mailbox, messageId, { read: true })
  }

  /**
   * Mark email as unread
   */
  async markAsUnread(mailbox: string, messageId: string): Promise<boolean> {
    return this.updateEmailStatus(mailbox, messageId, { read: false })
  }

  private async updateEmailStatus(mailbox: string, messageId: string, updates: Partial<InboxEmail>): Promise<boolean> {
    const s3 = await this.storage()

    const [localPart, domain] = mailbox.includes('@') ? mailbox.split('@') : [mailbox, this.domain]

    const inbox = await this.getInbox(mailbox, { limit: 1000 })
    const emailIndex = inbox.findIndex(e => e.messageId === messageId)

    if (emailIndex === -1) {
      return false
    }

    Object.assign(inbox[emailIndex]!, updates)

    await s3.putObject({
      bucket: this.bucket,
      key: `mailboxes/${domain}/${localPart}/inbox.json`,
      body: JSON.stringify(inbox, null, 2),
      contentType: 'application/json',
    })

    return true
  }

  private async storage(): Promise<EmailStorageClient> {
    if (this.storageFactory)
      return this.storageFactory()

    const { S3Client } = await import('@stacksjs/ts-cloud')
    return new S3Client(this.region)
  }

  private normalizeAddress(addr: EmailAddress | string): EmailAddress {
    if (typeof addr === 'string') {
      const match = addr.match(/^(.+?)\s*<(.+)>$/)
      if (match) {
        return { name: match[1]!.trim(), address: match[2]!.trim() }
      }
      return { address: addr }
    }
    return addr
  }

  private normalizeAddresses(addrs: string | string[] | EmailAddress[]): string[] {
    const arr = Array.isArray(addrs) ? addrs : [addrs]
    return arr.map(a => {
      if (typeof a === 'string') return a
      return a.name ? `${a.name} <${a.address}>` : a.address
    })
  }

  private renderTemplate(template: string, data: Record<string, any>): string {
    let result = template
    for (const [key, value] of Object.entries(data)) {
      // Escape special regex characters in the key to prevent regex injection
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      result = result.replace(new RegExp(`{{\\s*${escapedKey}\\s*}}`, 'g'), String(value))
    }
    return result
  }
}

// Export singleton instance
export const emailSDK = new EmailSDK()

// Export convenience functions
export const sendEmail = (message: EmailMessage) => emailSDK.send(message)
export const getInbox = (mailbox: string, options?: { limit?: number; offset?: number }) =>
  emailSDK.getInbox(mailbox, options)
export const getInboxStats = (mailbox: string) => emailSDK.getInboxStats(mailbox)
export const getUnreadCount = (mailbox: string) => emailSDK.getUnreadCount(mailbox)
export const searchEmails = (mailbox: string, options: EmailSearchOptions) => emailSDK.search(mailbox, options)
export const deleteEmail = (mailbox: string, messageId: string) => emailSDK.delete(mailbox, messageId)

export default EmailSDK
