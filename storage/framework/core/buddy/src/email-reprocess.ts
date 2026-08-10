import {
  extractEmailPreview,
  inboundMailboxRecipient,
  inboundMessageStorageId,
  normalizeEmailPreview,
  parseInboundEmail,
} from '@stacksjs/email'

export interface EmailReprocessObject {
  Key: string
  LastModified?: string
}

export interface EmailReprocessStorage {
  listAllObjects: (options: { bucket: string, prefix?: string }) => Promise<EmailReprocessObject[]>
  getObject: (bucket: string, key: string) => Promise<string>
  getObjectBytes: (bucket: string, key: string) => Promise<{ body: Uint8Array }>
  putObject: (options: {
    bucket: string
    key: string
    body: string | Buffer | Uint8Array
    contentType?: string
  }) => Promise<void>
}

export interface EmailReprocessMailboxReport {
  mailbox: string
  newCount: number
  refreshedCount: number
  total: number
}

export interface EmailReprocessReport {
  discovered: number
  processed: number
  skipped: Array<{ key: string, error: string }>
  mailboxes: EmailReprocessMailboxReport[]
}

interface ReprocessInboxEntry {
  messageId: string
  from: string
  fromName: string
  to: string
  subject: string
  date: string
  read: boolean
  preview: string
  hasAttachments: boolean
  path: string
}

export interface EmailReprocessOptions {
  storage: EmailReprocessStorage
  bucket: string
  prefix: string
  domain: string
  onProgress?: (processed: number, discovered: number) => void
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function withOperationTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  const expired = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => reject(new Error(`Email reprocess operation timed out after ${milliseconds}ms.`)), milliseconds)
  })

  try {
    return await Promise.race([promise, expired])
  }
  finally {
    if (timeout)
      clearTimeout(timeout)
  }
}

export async function reprocessInboundEmails(options: EmailReprocessOptions): Promise<EmailReprocessReport> {
  const domain = options.domain.trim().toLowerCase()
  if (!inboundMailboxRecipient(`validation@${domain}`, domain))
    throw new TypeError(`Invalid email domain: ${options.domain}`)

  const objects = await withOperationTimeout(options.storage.listAllObjects({
    bucket: options.bucket,
    prefix: options.prefix,
  }), 60_000)
  const inboxes = new Map<string, ReprocessInboxEntry[]>()
  const skipped: EmailReprocessReport['skipped'] = []
  let processed = 0

  for (const object of objects) {
    if (!object.Key || object.Key.endsWith('/'))
      continue

    try {
      const rawResult = await withOperationTimeout(
        options.storage.getObjectBytes(options.bucket, object.Key),
        15_000,
      )
      const rawEmail = rawResult.body
      if (!rawEmail.byteLength)
        continue

      const messageId = object.Key.split('/').pop() || object.Key
      const storageMessageId = inboundMessageStorageId(messageId)
      const parsedEmail = await parseInboundEmail(rawEmail)
      const parsedDate = parsedEmail.date ? new Date(parsedEmail.date) : null
      const date = parsedDate && !Number.isNaN(parsedDate.getTime())
        ? parsedDate.toISOString()
        : object.LastModified || new Date().toISOString()
      const fallbackRaw = new TextDecoder().decode(rawEmail)
      const preview = normalizeEmailPreview(parsedEmail.text || parsedEmail.html || extractEmailPreview(fallbackRaw))
      const hasAttachments = parsedEmail.attachments.length > 0
      const recipients = parsedEmail.recipients.length > 0 ? parsedEmail.recipients : [`unknown@${domain}`]

      for (const recipient of recipients) {
        const mailbox = inboundMailboxRecipient(recipient, domain)
        if (!mailbox)
          continue

        const instant = new Date(date)
        const year = instant.getFullYear()
        const month = String(instant.getMonth() + 1).padStart(2, '0')
        const day = String(instant.getDate()).padStart(2, '0')
        const emailPath = `mailboxes/${mailbox.domain}/${mailbox.localPart}/${year}/${month}/${day}/${storageMessageId}`
        const attachmentMetadata = parsedEmail.attachments.map(attachment => ({
          name: attachment.name,
          contentType: attachment.contentType,
          size: attachment.content.byteLength,
          ...(attachment.contentId ? { contentId: attachment.contentId } : {}),
          ...(attachment.disposition ? { disposition: attachment.disposition } : {}),
        }))
        const metadata = {
          messageId,
          from: parsedEmail.from,
          fromName: parsedEmail.fromName,
          to: mailbox.address,
          subject: parsedEmail.subject,
          date,
          preview,
          hasAttachments,
          attachments: attachmentMetadata,
        }
        const writes = [
          options.storage.putObject({
            bucket: options.bucket,
            key: `${emailPath}/raw.eml`,
            body: rawEmail,
            contentType: 'message/rfc822',
          }),
          options.storage.putObject({
            bucket: options.bucket,
            key: `${emailPath}/metadata.json`,
            body: JSON.stringify(metadata, null, 2),
            contentType: 'application/json',
          }),
          ...parsedEmail.attachments.map(attachment => options.storage.putObject({
            bucket: options.bucket,
            key: `${emailPath}/attachments/${attachment.storageName}`,
            body: attachment.content,
            contentType: attachment.contentType,
          })),
        ]
        if (parsedEmail.text) {
          writes.push(options.storage.putObject({
            bucket: options.bucket,
            key: `${emailPath}/body.txt`,
            body: parsedEmail.text,
            contentType: 'text/plain; charset=utf-8',
          }))
        }
        if (parsedEmail.html) {
          writes.push(options.storage.putObject({
            bucket: options.bucket,
            key: `${emailPath}/body.html`,
            body: parsedEmail.html,
            contentType: 'text/html; charset=utf-8',
          }))
        }
        await withOperationTimeout(Promise.all(writes), 30_000)

        const inboxKey = `${mailbox.domain}/${mailbox.localPart}`
        const inbox = inboxes.get(inboxKey) || []
        inbox.push({
          messageId,
          from: parsedEmail.from,
          fromName: parsedEmail.fromName,
          to: mailbox.address,
          subject: parsedEmail.subject,
          date,
          read: false,
          preview,
          hasAttachments,
          path: emailPath,
        })
        inboxes.set(inboxKey, inbox)
      }

      processed++
      options.onProgress?.(processed, objects.length)
    }
    catch (error) {
      skipped.push({ key: object.Key, error: errorMessage(error) })
    }
  }

  const mailboxes: EmailReprocessMailboxReport[] = []
  for (const [key, emails] of inboxes) {
    const [mailboxDomain, localPart] = key.split('/') as [string, string]
    const inboxJsonKey = `mailboxes/${mailboxDomain}/${localPart}/inbox.json`
    let existing: ReprocessInboxEntry[] = []
    try {
      const existingData = await options.storage.getObject(options.bucket, inboxJsonKey)
      existing = existingData ? JSON.parse(existingData) as ReprocessInboxEntry[] : []
    }
    catch {
      existing = []
    }

    const existingIds = new Set(existing.map(email => email.messageId))
    const refreshedIds = new Set(emails.map(email => email.messageId))
    const existingById = new Map(existing.map(email => [email.messageId, email]))
    const refreshed = emails.map((email) => {
      const current = existingById.get(email.messageId)
      return current ? { ...email, read: current.read === true } : email
    })
    const merged = [
      ...refreshed,
      ...existing.filter(email => !refreshedIds.has(email.messageId)),
    ]
      .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())
      .slice(0, 1000)
    const newCount = emails.filter(email => !existingIds.has(email.messageId)).length
    const refreshedCount = emails.length - newCount

    await withOperationTimeout(options.storage.putObject({
      bucket: options.bucket,
      key: inboxJsonKey,
      body: JSON.stringify(merged, null, 2),
      contentType: 'application/json',
    }), 30_000)
    mailboxes.push({
      mailbox: `${localPart}@${mailboxDomain}`,
      newCount,
      refreshedCount,
      total: merged.length,
    })
  }

  return {
    discovered: objects.length,
    processed,
    skipped,
    mailboxes,
  }
}
