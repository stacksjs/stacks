import type { Address, Mailbox } from 'postal-mime'
import PostalMime from 'postal-mime'
import { inboxAttachmentContentType } from './sdk/inbox-attachments'

const MAX_RAW_EMAIL_BYTES = 50 * 1024 * 1024
const MAX_ATTACHMENTS = 1000

export interface ParsedInboundAttachment {
  name: string
  storageName: string
  contentType: string
  content: Uint8Array
  contentId?: string
  disposition?: string
}

export interface ParsedInboundEmail {
  from: string
  fromName: string
  recipients: string[]
  subject: string
  date?: string
  html: string
  text: string
  attachments: ParsedInboundAttachment[]
}

function flattenAddresses(addresses: Address[] | undefined): Mailbox[] {
  return (addresses || []).flatMap((address) => {
    if ('group' in address && Array.isArray(address.group))
      return address.group
    return [address as Mailbox]
  })
}

function mailbox(address: Address | undefined): Mailbox | undefined {
  if (!address)
    return undefined
  if ('group' in address && Array.isArray(address.group))
    return address.group[0]
  return address as Mailbox
}

export function inboundAttachmentName(filename: string | null | undefined, index: number): string {
  const normalized = String(filename || '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/[\\/]/g, '_')
    .trim()
    .slice(0, 220)

  return normalized || `attachment-${index + 1}`
}

export function inboundAttachmentStorageName(filename: string, index: number): string {
  return `stacks-${String(index + 1).padStart(4, '0')}--${encodeURIComponent(filename)}`
}

export function inboundMailboxRecipient(address: string, expectedDomain: string): { address: string, domain: string, localPart: string } | null {
  const normalizedAddress = address.trim().toLowerCase()
  const separator = normalizedAddress.lastIndexOf('@')
  if (separator <= 0)
    return null

  const localPart = normalizedAddress.slice(0, separator)
  const domain = normalizedAddress.slice(separator + 1)
  if (domain !== expectedDomain.trim().toLowerCase())
    return null
  if (!/^[a-z0-9.!#$%&'*+?^_`{|}~=-]+$/i.test(localPart) || localPart.includes('..'))
    return null
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*$/i.test(domain))
    return null

  return { address: normalizedAddress, domain, localPart }
}

export function inboundMessageStorageId(messageId: string): string {
  const normalized = messageId
    .replace(/[\u0000-\u001F\u007F\\/]/g, '_')
    .trim()
    .slice(0, 240)
  if (!normalized || normalized === '.' || normalized === '..')
    throw new TypeError('Inbound email object has no safe message identifier.')
  return normalized
}

export async function parseInboundEmail(rawEmail: string | Uint8Array): Promise<ParsedInboundEmail> {
  const byteLength = typeof rawEmail === 'string'
    ? Buffer.byteLength(rawEmail)
    : rawEmail.byteLength
  if (byteLength > MAX_RAW_EMAIL_BYTES)
    throw new RangeError(`Raw email exceeds the ${MAX_RAW_EMAIL_BYTES} byte parsing limit.`)

  const parsed = await PostalMime.parse(rawEmail, {
    attachmentEncoding: 'arraybuffer',
    maxHeadersSize: 512 * 1024,
    maxNestingDepth: 64,
    maxRfc822NestingDepth: 4,
  })
  if (parsed.attachments.length > MAX_ATTACHMENTS)
    throw new RangeError(`Email contains more than ${MAX_ATTACHMENTS} attachments.`)

  const sender = mailbox(parsed.from)
  const recipients = flattenAddresses(parsed.to)
    .map(recipient => recipient.address?.trim().toLowerCase())
    .filter((address): address is string => Boolean(address))
  if (parsed.deliveredTo)
    recipients.push(parsed.deliveredTo.trim().toLowerCase())

  const attachments = parsed.attachments.map((attachment, index) => {
    const name = inboundAttachmentName(attachment.filename, index)
    const content = typeof attachment.content === 'string'
      ? new TextEncoder().encode(attachment.content)
      : new Uint8Array(attachment.content)

    return {
      name,
      storageName: inboundAttachmentStorageName(name, index),
      contentType: inboxAttachmentContentType(attachment.mimeType),
      content,
      ...(attachment.contentId ? { contentId: attachment.contentId } : {}),
      ...(attachment.disposition ? { disposition: attachment.disposition } : {}),
    }
  })

  return {
    from: sender?.address?.trim().toLowerCase() || '',
    fromName: sender?.name?.trim() || '',
    recipients: [...new Set(recipients)],
    subject: parsed.subject?.trim() || 'No Subject',
    ...(parsed.date ? { date: parsed.date } : {}),
    html: parsed.html?.trim() || '',
    text: parsed.text?.trim() || '',
    attachments,
  }
}
