/**
 * Serverless Mail API Handlers
 * 
 * Lambda functions that provide mailbox operations using S3 as storage
 */

import { S3Client } from 'ts-cloud/aws'
import { SESClient } from 'ts-cloud/aws'
import { DynamoDBClient } from 'ts-cloud/aws'
import { createHash } from 'crypto'

const s3 = new S3Client(process.env.AWS_REGION || 'us-east-1')
const ses = new SESClient(process.env.AWS_REGION || 'us-east-1')
const dynamodb = new DynamoDBClient(process.env.AWS_REGION || 'us-east-1')

const BUCKET = process.env.EMAIL_BUCKET || 'stacks-production-email'
const USERS_TABLE = process.env.USERS_TABLE || 'stacks-mail-users'

interface EmailMessage {
  id: string
  uid: number
  from: string
  to: string
  subject: string
  date: string
  size: number
  flags: string[]
  s3Key: string
  preview?: string
}

interface MailboxInfo {
  name: string
  messages: number
  unseen: number
  uidNext: number
  uidValidity: number
}

/**
 * Parse email headers from raw content
 */
function parseEmailHeaders(content: string): Record<string, string> {
  const headers: Record<string, string> = {}
  const headerEnd = content.indexOf('\r\n\r\n')
  const headerSection = headerEnd > 0 ? content.substring(0, headerEnd) : content.substring(0, 2000)
  
  let currentHeader = ''
  let currentValue = ''
  
  for (const line of headerSection.split('\r\n')) {
    if (line.startsWith(' ') || line.startsWith('\t')) {
      // Continuation of previous header
      currentValue += ' ' + line.trim()
    } else {
      // Save previous header
      if (currentHeader) {
        headers[currentHeader.toLowerCase()] = currentValue
      }
      // Start new header
      const colonIdx = line.indexOf(':')
      if (colonIdx > 0) {
        currentHeader = line.substring(0, colonIdx)
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
 * Get email body preview
 */
function getPreview(content: string, maxLength: number = 200): string {
  const bodyStart = content.indexOf('\r\n\r\n')
  if (bodyStart < 0) return ''
  
  let body = content.substring(bodyStart + 4)
  
  // Strip HTML tags if present
  body = body.replace(/<[^>]+>/g, ' ')
  // Normalize whitespace
  body = body.replace(/\s+/g, ' ').trim()
  
  return body.substring(0, maxLength)
}

/**
 * Authenticate user
 */
export async function authenticate(email: string, password: string): Promise<boolean> {
  try {
    const result = await dynamodb.getItem({
      TableName: USERS_TABLE,
      Key: { email: { S: email.toLowerCase() } },
    })
    
    if (!result.Item) return false
    
    const storedHash = result.Item.passwordHash?.S
    const inputHash = createHash('sha256').update(password).digest('hex')
    
    return storedHash === inputHash
  } catch (e) {
    console.error('Auth error:', e)
    return false
  }
}

/**
 * List mailboxes for a user
 */
export async function listMailboxes(userEmail: string): Promise<MailboxInfo[]> {
  // For now, we have a simple structure: INBOX, Sent, Drafts, Trash
  const mailboxes: MailboxInfo[] = [
    { name: 'INBOX', messages: 0, unseen: 0, uidNext: 1, uidValidity: 1 },
    { name: 'Sent', messages: 0, unseen: 0, uidNext: 1, uidValidity: 1 },
    { name: 'Drafts', messages: 0, unseen: 0, uidNext: 1, uidValidity: 1 },
    { name: 'Trash', messages: 0, unseen: 0, uidNext: 1, uidValidity: 1 },
  ]
  
  // Count messages in INBOX
  try {
    const objects = await s3.listAllObjects({ bucket: BUCKET, prefix: 'incoming/' })
    const userMessages = objects.filter(obj => !obj.Key.includes('AMAZON_SES_SETUP'))
    mailboxes[0].messages = userMessages.length
    mailboxes[0].unseen = userMessages.length // All unseen for now
    mailboxes[0].uidNext = userMessages.length + 1
  } catch (e) {
    console.error('Error listing mailboxes:', e)
  }
  
  return mailboxes
}

/**
 * List messages in a mailbox
 */
export async function listMessages(userEmail: string, mailbox: string = 'INBOX', options?: {
  limit?: number
  offset?: number
  includeBody?: boolean
}): Promise<EmailMessage[]> {
  const messages: EmailMessage[] = []
  const prefix = mailbox === 'INBOX' ? 'incoming/' : `${mailbox.toLowerCase()}/`
  
  try {
    const objects = await s3.listAllObjects({ bucket: BUCKET, prefix })
    
    let uid = 1
    for (const obj of objects) {
      // Skip setup notification
      if (obj.Key.includes('AMAZON_SES_SETUP')) continue
      
      try {
        const content = await s3.getObject(BUCKET, obj.Key)
        const headers = parseEmailHeaders(content)
        
        // Filter by recipient
        const to = headers.to?.toLowerCase() || ''
        const userLocal = userEmail.split('@')[0].toLowerCase()
        
        if (to.includes(userEmail.toLowerCase()) || to.includes(userLocal)) {
          const message: EmailMessage = {
            id: obj.Key.split('/').pop() || obj.Key,
            uid: uid++,
            from: headers.from || '',
            to: headers.to || '',
            subject: headers.subject || '(No Subject)',
            date: headers.date || new Date(obj.LastModified).toISOString(),
            size: obj.Size,
            flags: [],
            s3Key: obj.Key,
          }
          
          if (options?.includeBody) {
            message.preview = getPreview(content)
          }
          
          messages.push(message)
        }
      } catch (e) {
        console.error('Error reading message:', obj.Key, e)
      }
    }
  } catch (e) {
    console.error('Error listing messages:', e)
  }
  
  // Sort by date descending
  messages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  
  // Apply pagination
  if (options?.offset || options?.limit) {
    const start = options.offset || 0
    const end = options.limit ? start + options.limit : undefined
    return messages.slice(start, end)
  }
  
  return messages
}

/**
 * Get a single message
 */
export async function getMessage(userEmail: string, messageId: string, options?: {
  format?: 'full' | 'headers' | 'raw'
}): Promise<{ message: EmailMessage; content?: string; headers?: Record<string, string> } | null> {
  try {
    // Find the message
    const messages = await listMessages(userEmail, 'INBOX')
    const message = messages.find(m => m.id === messageId || m.uid.toString() === messageId)
    
    if (!message) return null
    
    const content = await s3.getObject(BUCKET, message.s3Key)
    const headers = parseEmailHeaders(content)
    
    if (options?.format === 'headers') {
      return { message, headers }
    }
    
    if (options?.format === 'raw') {
      return { message, content }
    }
    
    // Full format - parse body
    const bodyStart = content.indexOf('\r\n\r\n')
    const body = bodyStart > 0 ? content.substring(bodyStart + 4) : ''
    
    return {
      message: { ...message, preview: body },
      headers,
      content: body,
    }
  } catch (e) {
    console.error('Error getting message:', e)
    return null
  }
}

/**
 * Delete a message (move to Trash or permanently delete)
 */
export async function deleteMessage(userEmail: string, messageId: string, permanent: boolean = false): Promise<boolean> {
  try {
    const messages = await listMessages(userEmail, 'INBOX')
    const message = messages.find(m => m.id === messageId || m.uid.toString() === messageId)
    
    if (!message) return false
    
    if (permanent) {
      await s3.deleteObject(BUCKET, message.s3Key)
    } else {
      // Move to trash
      const trashKey = message.s3Key.replace('incoming/', 'trash/')
      await s3.copyObject(BUCKET, message.s3Key, BUCKET, trashKey)
      await s3.deleteObject(BUCKET, message.s3Key)
    }
    
    return true
  } catch (e) {
    console.error('Error deleting message:', e)
    return false
  }
}

/**
 * Send an email
 */
export async function sendMessage(userEmail: string, params: {
  to: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
  subject: string
  text?: string
  html?: string
  replyTo?: string
}): Promise<{ messageId: string } | null> {
  try {
    const result = await ses.sendEmail({
      FromEmailAddress: userEmail,
      Destination: {
        ToAddresses: Array.isArray(params.to) ? params.to : [params.to],
        CcAddresses: params.cc ? (Array.isArray(params.cc) ? params.cc : [params.cc]) : undefined,
        BccAddresses: params.bcc ? (Array.isArray(params.bcc) ? params.bcc : [params.bcc]) : undefined,
      },
      ReplyToAddresses: params.replyTo ? [params.replyTo] : undefined,
      Content: {
        Simple: {
          Subject: { Data: params.subject },
          Body: {
            Text: params.text ? { Data: params.text } : undefined,
            Html: params.html ? { Data: params.html } : undefined,
          },
        },
      },
    })
    
    return { messageId: result.MessageId || '' }
  } catch (e) {
    console.error('Error sending message:', e)
    return null
  }
}

/**
 * Mark message as read/unread
 */
export async function setMessageFlags(userEmail: string, messageId: string, flags: {
  seen?: boolean
  flagged?: boolean
  answered?: boolean
}): Promise<boolean> {
  // Store flags in DynamoDB
  try {
    const flagKey = `${userEmail}:${messageId}`
    await dynamodb.putItem({
      TableName: `${USERS_TABLE}-flags`,
      Item: {
        id: { S: flagKey },
        seen: { BOOL: flags.seen || false },
        flagged: { BOOL: flags.flagged || false },
        answered: { BOOL: flags.answered || false },
        updatedAt: { S: new Date().toISOString() },
      },
    })
    return true
  } catch (e) {
    console.error('Error setting flags:', e)
    return false
  }
}

/**
 * Search messages
 */
export async function searchMessages(userEmail: string, query: {
  from?: string
  to?: string
  subject?: string
  body?: string
  since?: string
  before?: string
}): Promise<EmailMessage[]> {
  const allMessages = await listMessages(userEmail, 'INBOX', { includeBody: true })
  
  return allMessages.filter(msg => {
    if (query.from && !msg.from.toLowerCase().includes(query.from.toLowerCase())) return false
    if (query.to && !msg.to.toLowerCase().includes(query.to.toLowerCase())) return false
    if (query.subject && !msg.subject.toLowerCase().includes(query.subject.toLowerCase())) return false
    if (query.body && !msg.preview?.toLowerCase().includes(query.body.toLowerCase())) return false
    if (query.since && new Date(msg.date) < new Date(query.since)) return false
    if (query.before && new Date(msg.date) > new Date(query.before)) return false
    return true
  })
}
