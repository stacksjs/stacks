import { dashboardApi } from './dashboard-api'
import { pushToast } from './toasts'

export type DisplayDensity = 'comfortable' | 'default' | 'compact'
export type MailTheme = 'light' | 'dark' | 'system'
export type MailLanguage = 'en' | 'fr' | 'de' | 'es' | 'ja'
export type ReplyBehavior = 'reply' | 'replyAll'
export type AutoAdvance = 'newer' | 'older' | 'back'
export type NotificationSound = 'default' | 'subtle' | 'none'

export interface MailPreference {
  id: number | null
  mailbox: string
  accountName: string
  signature: string
  displayDensity: DisplayDensity
  theme: MailTheme
  language: MailLanguage
  defaultReplyBehavior: ReplyBehavior
  sendAndArchive: boolean
  autoAdvance: AutoAdvance
  desktopNotifications: boolean
  notificationSound: NotificationSound
  notificationPreview: boolean
  filters: string
  blockedSenders: string
  labels: string
  loadRemoteImages: boolean
  showExternalContent: boolean
  vacationEnabled: boolean
  vacationStartDate: string
  vacationEndDate: string
  vacationSubject: string
  vacationMessage: string
}

interface MailPreferenceResponse {
  success?: boolean
  preference: MailPreference
}

export async function fetchMailPreference(mailbox?: string): Promise<MailPreference | null> {
  try {
    const query = mailbox ? `?mailbox=${encodeURIComponent(mailbox)}` : ''
    const result = await dashboardApi<MailPreferenceResponse>(`/api/dashboard/email/preferences${query}`)
    return result.preference
  }
  catch (error) {
    pushToast('error', 'Could not load mail settings', { detail: String(error) })
    return null
  }
}

export async function saveMailPreference(preference: Omit<MailPreference, 'id'>): Promise<MailPreference | null> {
  try {
    const result = await dashboardApi<MailPreferenceResponse>('/api/dashboard/email/preferences', {
      method: 'PUT',
      body: preference,
    })
    pushToast('success', 'Mail settings saved', { detail: preference.mailbox })
    return result.preference
  }
  catch (error) {
    pushToast('error', 'Could not save mail settings', { detail: String(error) })
    return null
  }
}
