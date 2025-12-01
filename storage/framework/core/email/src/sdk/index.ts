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

/**
 * Email SDK class for Stacks applications
 */
export class EmailSDK {
  private bucket: string
  private region: string
  private domain: string

  constructor(options?: { bucket?: string; region?: string; domain?: string }) {
    this.bucket = options?.bucket || `${process.env.APP_NAME?.toLowerCase() || 'stacks'}-emails`
    this.region = options?.region || process.env.AWS_REGION || 'us-east-1'
    this.domain = options?.domain || emailConfig?.from?.address?.split('@')[1] || 'stacksjs.com'
  }

  /**
   * Send an email
   */
  async send(message: EmailMessage): Promise<SendResult> {
    try {
      const { SESClient } = await import('ts-cloud/aws')
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
    catch (error: any) {
      return {
        success: false,
        error: error.message,
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
      const { S3Client } = await import('ts-cloud/aws')
      const s3 = new S3Client(this.region)

      const [localPart, domain] = mailbox.includes('@') ? mailbox.split('@') : [mailbox, this.domain]

      const indexKey = `mailboxes/${domain}/${localPart}/inbox.json`

      const result = await s3.getObject({
        Bucket: this.bucket,
        Key: indexKey,
      })

      if (!result.Body) {
        return []
      }

      let inbox: InboxEmail[] = JSON.parse(result.Body)

      // Apply pagination
      const offset = options?.offset || 0
      const limit = options?.limit || 50

      return inbox.slice(offset, offset + limit)
    }
    catch (error: any) {
      if (error.message.includes('NoSuchKey') || error.message.includes('404')) {
        return []
      }
      throw error
    }
  }

  /**
   * Get a specific email
   */
  async getEmail(mailbox: string, messageId: string): Promise<{
    metadata: Record<string, any>
    html?: string
    text?: string
    raw?: string
  } | null> {
    try {
      const { S3Client } = await import('ts-cloud/aws')
      const s3 = new S3Client(this.region)

      const [localPart, domain] = mailbox.includes('@') ? mailbox.split('@') : [mailbox, this.domain]

      // First get the inbox to find the email path
      const inbox = await this.getInbox(mailbox, { limit: 1000 })
      const email = inbox.find(e => e.messageId === messageId)

      if (!email) {
        return null
      }

      const basePath = email.path

      // Get metadata
      const metaResult = await s3.getObject({
        Bucket: this.bucket,
        Key: `${basePath}/metadata.json`,
      })

      const metadata = metaResult.Body ? JSON.parse(metaResult.Body) : {}

      // Try to get HTML body
      let html: string | undefined
      try {
        const htmlResult = await s3.getObject({
          Bucket: this.bucket,
          Key: `${basePath}/body.html`,
        })
        html = htmlResult.Body
      }
      catch {
        // No HTML version
      }

      // Try to get text body
      let text: string | undefined
      try {
        const textResult = await s3.getObject({
          Bucket: this.bucket,
          Key: `${basePath}/body.txt`,
        })
        text = textResult.Body
      }
      catch {
        // No text version
      }

      return { metadata, html, text }
    }
    catch (error: any) {
      if (error.message.includes('NoSuchKey') || error.message.includes('404')) {
        return null
      }
      throw error
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
    try {
      const { S3Client } = await import('ts-cloud/aws')
      const s3 = new S3Client(this.region)

      const [localPart, domain] = mailbox.includes('@') ? mailbox.split('@') : [mailbox, this.domain]

      // Get inbox and find the email
      const inbox = await this.getInbox(mailbox, { limit: 1000 })
      const emailIndex = inbox.findIndex(e => e.messageId === messageId)

      if (emailIndex === -1) {
        return false
      }

      const email = inbox[emailIndex]

      // Delete the email files from S3
      // Note: In production, you might want to use S3 delete objects API
      const basePath = email.path
      const keysToDelete = [
        `${basePath}/metadata.json`,
        `${basePath}/raw.eml`,
        `${basePath}/body.html`,
        `${basePath}/body.txt`,
        `${basePath}/preview.txt`,
      ]

      for (const key of keysToDelete) {
        try {
          await s3.deleteObject({
            Bucket: this.bucket,
            Key: key,
          })
        }
        catch {
          // Ignore errors for files that don't exist
        }
      }

      // Update inbox index
      inbox.splice(emailIndex, 1)

      await s3.putObject({
        Bucket: this.bucket,
        Key: `mailboxes/${domain}/${localPart}/inbox.json`,
        Body: JSON.stringify(inbox, null, 2),
        ContentType: 'application/json',
      })

      return true
    }
    catch {
      return false
    }
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
    try {
      const { S3Client } = await import('ts-cloud/aws')
      const s3 = new S3Client(this.region)

      const [localPart, domain] = mailbox.includes('@') ? mailbox.split('@') : [mailbox, this.domain]

      const inbox = await this.getInbox(mailbox, { limit: 1000 })
      const emailIndex = inbox.findIndex(e => e.messageId === messageId)

      if (emailIndex === -1) {
        return false
      }

      Object.assign(inbox[emailIndex], updates)

      await s3.putObject({
        Bucket: this.bucket,
        Key: `mailboxes/${domain}/${localPart}/inbox.json`,
        Body: JSON.stringify(inbox, null, 2),
        ContentType: 'application/json',
      })

      return true
    }
    catch {
      return false
    }
  }

  private normalizeAddress(addr: EmailAddress | string): EmailAddress {
    if (typeof addr === 'string') {
      const match = addr.match(/^(.+?)\s*<(.+)>$/)
      if (match) {
        return { name: match[1].trim(), address: match[2].trim() }
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
      result = result.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), String(value))
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
export const searchEmails = (mailbox: string, options: EmailSearchOptions) => emailSDK.search(mailbox, options)
export const deleteEmail = (mailbox: string, messageId: string) => emailSDK.delete(mailbox, messageId)

export default EmailSDK
