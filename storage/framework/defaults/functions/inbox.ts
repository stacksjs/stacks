/**
 * Inbox Composable
 *
 * Reads inbound mailbox messages and exposes inbox actions for the dashboard.
 */

import { ref } from '@stacksjs/stx'
import { get } from './api'
import { dashboardApi, dashboardDownload } from './dashboard-api'
import { pushToast } from './toasts'

export type InboxActivityRange = 'day' | 'week' | 'month' | 'year'

export interface InboxActivity {
  mailbox: string
  range: InboxActivityRange
  period: {
    start: string
    end: string
  }
  stats: {
    messages: number
    unread: number
    failed: number
    attachments: number
    message_change: number | null
    unread_rate: number
  }
  folder_counts: Record<'inbox' | 'starred' | 'sent' | 'drafts' | 'archive' | 'spam' | 'trash', number>
  mailbox_state: {
    read: number
    unread: number
  }
  delivery_statuses: {
    sent: number
    delivered: number
    failed: number
    pending: number
  }
  series: Array<{
    key: string
    label: string
    received: number
    sent: number
    failed: number
  }>
  recent: Array<{
    id: string
    direction: 'received' | 'sent'
    subject: string
    correspondent: string
    occurred_at: string
    status: string
  }>
}

export interface InboxSendInput {
  to: string
  subject: string
  body: string
}

export interface DashboardInboxEmail {
  id: string
  from: string
  email: string
  subject: string
  preview: string
  bodyHtml: string
  bodyText: string
  date: string
  read: boolean
  hasAttachments: boolean
  attachments: DashboardInboxAttachment[]
  detailsLoaded: boolean
}

export interface DashboardInboxAttachment {
  id: string
  name: string
  size: number
  lastModified?: string
}

interface DashboardInboxEntry {
  messageId: string
  from: string
  fromName?: string
  subject?: string
  preview?: string
  date: string
  read?: boolean
  hasAttachments?: boolean
}

interface DashboardInboxResponse {
  mailbox?: string
  total?: number
  emails?: DashboardInboxEntry[]
  error?: string
}

interface DashboardInboxBodyResponse {
  html?: string
  text?: string
  attachments?: DashboardInboxAttachment[]
  error?: string
}

interface InboxMutationResult {
  success: boolean
  mailbox?: string
  messageId?: string
}

export interface LoadedDashboardInbox {
  mailbox: string
  emails: DashboardInboxEmail[]
  error: string
}

export function parseInboxSender(from: string, fromName = ''): { name: string; email: string } {
  const match = from.match(/^"?([^"<]+)"?\s*<([^>]+)>$/)
  const matchedName = match?.[1]
  const matchedEmail = match?.[2]
  if (matchedName && matchedEmail)
    return { name: fromName.trim() || matchedName.trim(), email: matchedEmail.trim() }
  return { name: fromName.trim() || from, email: from }
}

export function normalizeInboxPreview(preview: string, maxLength = 200): string {
  let result = preview.trim().replace(/^[-=_]{2,}[^\s]*\s+/, '')

  for (let pass = 0; pass < 6; pass++) {
    const next = result
      .replace(/^content-transfer-encoding:\s*[^\s]+\s*/i, '')
      .replace(/^mime-version:\s*[^\s]+\s*/i, '')
      .replace(/^content-description:\s*[^\s]+\s*/i, '')
      .replace(/^content-type:\s*[^\s;]+(?:;\s*(?:charset|boundary|name)\s*=\s*(?:"[^"]*"|[^\s]+))*\s*/i, '')
    if (next === result)
      break
    result = next
  }

  const encoded = result.replace(/^[-=_]{4,}[^\s]*\s*/, '').replace(/=\r?\n/g, '')
  const bytes: number[] = []
  const encoder = new TextEncoder()
  for (let index = 0; index < encoded.length; index++) {
    const token = encoded.slice(index, index + 3)
    if (/^=[0-9a-f]{2}$/i.test(token)) {
      bytes.push(Number.parseInt(token.slice(1), 16))
      index += 2
    }
    else {
      bytes.push(...encoder.encode(encoded[index]!))
    }
  }

  return new TextDecoder().decode(Uint8Array.from(bytes))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

export function mapDashboardInboxEntry(item: DashboardInboxEntry): DashboardInboxEmail {
  const sender = parseInboxSender(item.from || '', item.fromName || '')
  return {
    id: item.messageId,
    from: sender.name || sender.email,
    email: sender.email,
    subject: item.subject || '(no subject)',
    preview: normalizeInboxPreview(item.preview || ''),
    bodyHtml: '',
    bodyText: '',
    date: item.date,
    read: item.read === true,
    hasAttachments: item.hasAttachments === true,
    attachments: [],
    detailsLoaded: false,
  }
}

export async function fetchDashboardInbox(mailbox?: string): Promise<LoadedDashboardInbox> {
  const query = mailbox ? `?mailbox=${encodeURIComponent(mailbox)}` : ''
  const data = await dashboardApi<DashboardInboxResponse>(`/api/dashboard/email/inbox${query}`)
  return {
    mailbox: data.mailbox || mailbox || '',
    emails: (data.emails || []).map(mapDashboardInboxEntry),
    error: data.error || '',
  }
}

export async function fetchDashboardInboxBody(messageId: string, mailbox?: string): Promise<Pick<DashboardInboxEmail, 'attachments' | 'bodyHtml' | 'bodyText' | 'detailsLoaded' | 'hasAttachments'>> {
  const query = mailbox ? `?mailbox=${encodeURIComponent(mailbox)}` : ''
  const data = await dashboardApi<DashboardInboxBodyResponse>(`/api/dashboard/email/inbox/${encodeURIComponent(messageId)}${query}`)
  if (data.error)
    throw new Error(data.error)
  return {
    bodyHtml: data.html || '',
    bodyText: data.text || '',
    attachments: data.attachments || [],
    detailsLoaded: true,
    hasAttachments: (data.attachments || []).length > 0,
  }
}

export async function downloadDashboardInboxAttachment(
  messageId: string,
  attachment: DashboardInboxAttachment,
  mailbox?: string,
): Promise<void> {
  const query = mailbox ? `?mailbox=${encodeURIComponent(mailbox)}` : ''
  const path = `/api/dashboard/email/inbox/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachment.id)}${query}`
  await dashboardDownload(path, attachment.name)
}

export async function fetchInboxActivity(range: InboxActivityRange): Promise<InboxActivity | null> {
  try {
    return await dashboardApi<InboxActivity>(`/api/dashboard/email/activity?range=${range}`)
  }
  catch (error) {
    pushToast('error', 'Could not load mail activity', { detail: String(error) })
    return null
  }
}

export async function sendInboxEmail(input: InboxSendInput): Promise<boolean> {
  try {
    await dashboardApi<InboxMutationResult>('/api/dashboard/email/send', {
      method: 'POST',
      body: input,
    })
    pushToast('success', 'Email sent', { detail: `Delivered to ${input.to}` })
    return true
  }
  catch (error) {
    pushToast('error', 'Could not send email', { detail: String(error) })
    return false
  }
}

export async function setInboxEmailReadState(messageId: string, read: boolean, mailbox?: string): Promise<boolean> {
  try {
    await dashboardApi<InboxMutationResult>(`/api/dashboard/email/${read ? 'read' : 'unread'}`, {
      method: 'POST',
      body: { messageId, ...(mailbox ? { mailbox } : {}) },
    })
    return true
  }
  catch (error) {
    pushToast('error', `Could not mark email as ${read ? 'read' : 'unread'}`, { detail: String(error) })
    return false
  }
}

export async function deleteInboxEmail(messageId: string, mailbox?: string): Promise<boolean> {
  try {
    const query = mailbox ? `?mailbox=${encodeURIComponent(mailbox)}` : ''
    await dashboardApi<InboxMutationResult>(`/api/dashboard/email/inbox/${encodeURIComponent(messageId)}${query}`, {
      method: 'DELETE',
    })
    pushToast('success', 'Email deleted')
    return true
  }
  catch (error) {
    pushToast('error', 'Could not delete email', { detail: String(error) })
    return false
  }
}

export interface InboxEntry {
  id: string
  source: 'memory' | 'disk'
  from: string
  to: string
  subject: string
  preview: string
  sent_at: string
  has_html: boolean
  has_text: boolean
  size: number
}

export interface InboxBody {
  id: string
  from: string
  to: string
  cc?: string
  bcc?: string
  subject: string
  sent_at: string
  html: string
  text: string
  error?: string
}

export function useInbox() {
  const emails = ref<InboxEntry[]>([])
  const driver = ref<string>('log')
  const total = ref(0)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const selected = ref<InboxBody | null>(null)

  async function fetchEmails() {
    isLoading.value = true
    error.value = null
    try {
      const data = await get<{ data: InboxEntry[], total: number, driver: string }>('/inbox')
      emails.value = data.data || []
      total.value = data.total || 0
      driver.value = data.driver || 'log'
    }
    catch (e) {
      error.value = 'Failed to load inbox.'
      console.error('Failed to fetch inbox:', e)
    }
    finally {
      isLoading.value = false
    }
  }

  async function openEmail(id: string) {
    error.value = null
    try {
      const data = await get<InboxBody>(`/inbox/${encodeURIComponent(id)}`)
      if (data.error) {
        error.value = data.error
        selected.value = null
        return
      }
      selected.value = data
    }
    catch (e) {
      error.value = 'Failed to open email.'
      console.error('Failed to fetch email:', e)
    }
  }

  function closeEmail() {
    selected.value = null
  }

  return {
    emails,
    driver,
    total,
    isLoading,
    error,
    selected,
    fetchEmails,
    openEmail,
    closeEmail,
  }
}
