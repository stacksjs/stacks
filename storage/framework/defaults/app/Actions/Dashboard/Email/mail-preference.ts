import { config } from '@stacksjs/config'

export interface MailPreferenceInput {
  mailbox: string
  accountName: string
  signature: string
  displayDensity: 'comfortable' | 'default' | 'compact'
  theme: 'light' | 'dark' | 'system'
  language: 'en' | 'fr' | 'de' | 'es' | 'ja'
  defaultReplyBehavior: 'reply' | 'replyAll'
  sendAndArchive: boolean
  autoAdvance: 'newer' | 'older' | 'back'
  desktopNotifications: boolean
  notificationSound: 'default' | 'subtle' | 'none'
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

export function defaultMailbox(): string {
  const email = (config as any)?.email || {}
  const domain = String(email.domain || 'stacksjs.com')
  const configured = Array.isArray(email.mailboxes) ? email.mailboxes[0] : undefined
  const mailbox = typeof configured === 'string' ? configured : configured?.email
  if (mailbox)
    return String(mailbox).includes('@') ? String(mailbox) : `${mailbox}@${domain}`

  return `chris@${domain}`
}

export function normalizeStringList(value: string): string {
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed))
      return '[]'

    const entries = parsed
      .filter(item => typeof item === 'string')
      .map(item => item.trim())
      .filter(Boolean)

    return JSON.stringify([...new Set(entries)].slice(0, 100))
  }
  catch {
    return '[]'
  }
}

export function defaultMailPreference(mailbox = defaultMailbox()): MailPreferenceInput {
  return {
    mailbox,
    accountName: 'Stacks',
    signature: '',
    displayDensity: 'default',
    theme: 'system',
    language: 'en',
    defaultReplyBehavior: 'replyAll',
    sendAndArchive: true,
    autoAdvance: 'newer',
    desktopNotifications: true,
    notificationSound: 'default',
    notificationPreview: true,
    filters: '[]',
    blockedSenders: '[]',
    labels: '[]',
    loadRemoteImages: false,
    showExternalContent: false,
    vacationEnabled: false,
    vacationStartDate: '',
    vacationEndDate: '',
    vacationSubject: '',
    vacationMessage: '',
  }
}

export function mailPreferenceAttributes(input: MailPreferenceInput): Record<string, unknown> {
  return {
    mailbox: input.mailbox,
    account_name: input.accountName,
    signature: input.signature,
    display_density: input.displayDensity,
    theme: input.theme,
    language: input.language,
    default_reply_behavior: input.defaultReplyBehavior,
    send_and_archive: input.sendAndArchive,
    auto_advance: input.autoAdvance,
    desktop_notifications: input.desktopNotifications,
    notification_sound: input.notificationSound,
    notification_preview: input.notificationPreview,
    filters: normalizeStringList(input.filters),
    blocked_senders: normalizeStringList(input.blockedSenders),
    labels: normalizeStringList(input.labels),
    load_remote_images: input.loadRemoteImages,
    show_external_content: input.showExternalContent,
    vacation_enabled: input.vacationEnabled,
    vacation_start_date: input.vacationStartDate || null,
    vacation_end_date: input.vacationEndDate || null,
    vacation_subject: input.vacationSubject || null,
    vacation_message: input.vacationMessage || null,
  }
}

export function serializeMailPreference(record: any, mailbox = defaultMailbox()): MailPreferenceInput & { id: number | null } {
  const defaults = defaultMailPreference(mailbox)
  if (!record)
    return { id: null, ...defaults }

  const stringValue = (key: string, fallback: string): string => {
    const value = record.get(key)
    return value === null || value === undefined ? fallback : String(value)
  }
  const booleanValue = (key: string, fallback: boolean): boolean => {
    const value = record.get(key)
    if (value === null || value === undefined)
      return fallback
    return value !== false && value !== 0 && value !== '0' && value !== 'false'
  }

  return {
    id: Number(record.get('id')) || null,
    mailbox: stringValue('mailbox', defaults.mailbox),
    accountName: stringValue('account_name', defaults.accountName),
    signature: stringValue('signature', defaults.signature),
    displayDensity: stringValue('display_density', defaults.displayDensity) as MailPreferenceInput['displayDensity'],
    theme: stringValue('theme', defaults.theme) as MailPreferenceInput['theme'],
    language: stringValue('language', defaults.language) as MailPreferenceInput['language'],
    defaultReplyBehavior: stringValue('default_reply_behavior', defaults.defaultReplyBehavior) as MailPreferenceInput['defaultReplyBehavior'],
    sendAndArchive: booleanValue('send_and_archive', defaults.sendAndArchive),
    autoAdvance: stringValue('auto_advance', defaults.autoAdvance) as MailPreferenceInput['autoAdvance'],
    desktopNotifications: booleanValue('desktop_notifications', defaults.desktopNotifications),
    notificationSound: stringValue('notification_sound', defaults.notificationSound) as MailPreferenceInput['notificationSound'],
    notificationPreview: booleanValue('notification_preview', defaults.notificationPreview),
    filters: stringValue('filters', defaults.filters),
    blockedSenders: stringValue('blocked_senders', defaults.blockedSenders),
    labels: stringValue('labels', defaults.labels),
    loadRemoteImages: booleanValue('load_remote_images', defaults.loadRemoteImages),
    showExternalContent: booleanValue('show_external_content', defaults.showExternalContent),
    vacationEnabled: booleanValue('vacation_enabled', defaults.vacationEnabled),
    vacationStartDate: stringValue('vacation_start_date', defaults.vacationStartDate),
    vacationEndDate: stringValue('vacation_end_date', defaults.vacationEndDate),
    vacationSubject: stringValue('vacation_subject', defaults.vacationSubject),
    vacationMessage: stringValue('vacation_message', defaults.vacationMessage),
  }
}
