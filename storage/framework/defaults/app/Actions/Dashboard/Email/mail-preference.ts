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

  const fromAddress = String(email.from?.address || '').trim()
  if (fromAddress)
    return fromAddress

  return `hello@${domain}`
}

export function normalizeStringList(value: string, field = 'list'): string {
  if (typeof value !== 'string')
    throw new TypeError(`${field} must be a JSON string array.`)

  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  }
  catch (error) {
    throw new TypeError(`${field} must contain valid JSON.`, { cause: error })
  }

  if (!Array.isArray(parsed))
    throw new TypeError(`${field} must be a JSON array.`)
  if (parsed.length > 100)
    throw new RangeError(`${field} may contain at most 100 entries.`)
  if (parsed.some(item => typeof item !== 'string'))
    throw new TypeError(`${field} may contain only strings.`)

  const entries = parsed
    .map(item => item.trim())
    .filter(Boolean)

  return JSON.stringify([...new Set(entries)])
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
    filters: normalizeStringList(input.filters, 'filters'),
    blocked_senders: normalizeStringList(input.blockedSenders, 'blockedSenders'),
    labels: normalizeStringList(input.labels, 'labels'),
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

  const requiredString = (key: string): string => {
    const value = record.get(key)
    if (typeof value !== 'string')
      throw new TypeError(`MailPreference.${key} must be a string.`)
    return value
  }
  const optionalString = (key: string): string => {
    const value = record.get(key)
    if (value === null || value === undefined)
      return ''
    if (typeof value !== 'string')
      throw new TypeError(`MailPreference.${key} must be a string or null.`)
    return value
  }
  const enumValue = <T extends string>(key: string, allowed: readonly T[]): T => {
    const value = requiredString(key)
    if (!allowed.includes(value as T))
      throw new TypeError(`MailPreference.${key} contains an unsupported value.`)
    return value as T
  }
  const booleanValue = (key: string): boolean => {
    const value = record.get(key)
    if (value === true || value === 1 || value === '1' || value === 'true')
      return true
    if (value === false || value === 0 || value === '0' || value === 'false')
      return false
    throw new TypeError(`MailPreference.${key} must be a boolean.`)
  }
  const id = Number(record.get('id'))
  if (!Number.isInteger(id) || id < 1)
    throw new TypeError('MailPreference.id must be a positive integer.')

  return {
    id,
    mailbox: requiredString('mailbox'),
    accountName: requiredString('account_name'),
    signature: optionalString('signature'),
    displayDensity: enumValue('display_density', ['comfortable', 'default', 'compact']),
    theme: enumValue('theme', ['light', 'dark', 'system']),
    language: enumValue('language', ['en', 'fr', 'de', 'es', 'ja']),
    defaultReplyBehavior: enumValue('default_reply_behavior', ['reply', 'replyAll']),
    sendAndArchive: booleanValue('send_and_archive'),
    autoAdvance: enumValue('auto_advance', ['newer', 'older', 'back']),
    desktopNotifications: booleanValue('desktop_notifications'),
    notificationSound: enumValue('notification_sound', ['default', 'subtle', 'none']),
    notificationPreview: booleanValue('notification_preview'),
    filters: normalizeStringList(requiredString('filters'), 'MailPreference.filters'),
    blockedSenders: normalizeStringList(requiredString('blocked_senders'), 'MailPreference.blocked_senders'),
    labels: normalizeStringList(requiredString('labels'), 'MailPreference.labels'),
    loadRemoteImages: booleanValue('load_remote_images'),
    showExternalContent: booleanValue('show_external_content'),
    vacationEnabled: booleanValue('vacation_enabled'),
    vacationStartDate: optionalString('vacation_start_date'),
    vacationEndDate: optionalString('vacation_end_date'),
    vacationSubject: optionalString('vacation_subject'),
    vacationMessage: optionalString('vacation_message'),
  }
}
