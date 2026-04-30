/**
 * Inbox Composable
 *
 * Reads captured transactional emails from the framework's mail log driver
 * (in-memory + storage/logs/mail/*.html) for the dashboard inbox view.
 */

import { ref } from '@stacksjs/stx'
import { get } from './api'

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
