import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { MailPreference } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import {
  defaultMailbox,
  type MailPreferenceInput,
  mailPreferenceAttributes,
  normalizeStringList,
  serializeMailPreference,
} from './mail-preference'

const DENSITIES = new Set(['comfortable', 'default', 'compact'])
const THEMES = new Set(['light', 'dark', 'system'])
const LANGUAGES = new Set(['en', 'fr', 'de', 'es', 'ja'])
const REPLY_BEHAVIORS = new Set(['reply', 'replyAll'])
const AUTO_ADVANCE_OPTIONS = new Set(['newer', 'older', 'back'])
const SOUNDS = new Set(['default', 'subtle', 'none'])

function stringInput(
  request: RequestInstance,
  key: string,
  fields: Record<string, string>,
  fallback = '',
): string {
  const value = request.get(key)
  if (value === null || value === undefined)
    return fallback
  if (typeof value !== 'string') {
    fields[key] = 'This field must be a string.'
    return fallback
  }
  return value
}

function booleanInput(
  request: RequestInstance,
  key: string,
  fields: Record<string, string>,
  fallback: boolean,
): boolean {
  const value = request.get(key)
  if (value === null || value === undefined)
    return fallback
  if (typeof value !== 'boolean') {
    fields[key] = 'This field must be a boolean.'
    return fallback
  }
  return value
}

function enumInput<T extends string>(
  request: RequestInstance,
  key: string,
  allowed: Set<string>,
  fields: Record<string, string>,
  fallback: T,
): T {
  const value = stringInput(request, key, fields, fallback)
  if (!allowed.has(value)) {
    fields[key] = `Choose one of: ${[...allowed].join(', ')}.`
    return fallback
  }
  return value as T
}

function inputFromRequest(
  request: RequestInstance,
  mailbox: string,
): { fields: Record<string, string>, input: MailPreferenceInput } {
  const fields: Record<string, string> = {}
  const accountName = stringInput(request, 'accountName', fields, 'Stacks').trim()
  const signature = stringInput(request, 'signature', fields)
  const vacationSubject = stringInput(request, 'vacationSubject', fields)
  const vacationMessage = stringInput(request, 'vacationMessage', fields)

  if (!accountName)
    fields.accountName = 'Account name is required.'
  else if (accountName.length > 255)
    fields.accountName = 'Account name must be 255 characters or fewer.'
  if (signature.length > 20_000)
    fields.signature = 'Signature must be 20,000 characters or fewer.'
  if (vacationSubject.length > 255)
    fields.vacationSubject = 'Vacation subject must be 255 characters or fewer.'
  if (vacationMessage.length > 20_000)
    fields.vacationMessage = 'Vacation message must be 20,000 characters or fewer.'

  const listInput = (key: 'filters' | 'blockedSenders' | 'labels'): string => {
    const value = stringInput(request, key, fields, '[]')
    try {
      return normalizeStringList(value, key)
    }
    catch (error) {
      fields[key] = error instanceof Error ? error.message : `${key} is invalid.`
      return '[]'
    }
  }

  return {
    fields,
    input: {
      mailbox,
      accountName,
      signature,
      displayDensity: enumInput(request, 'displayDensity', DENSITIES, fields, 'default'),
      theme: enumInput(request, 'theme', THEMES, fields, 'system'),
      language: enumInput(request, 'language', LANGUAGES, fields, 'en'),
      defaultReplyBehavior: enumInput(request, 'defaultReplyBehavior', REPLY_BEHAVIORS, fields, 'replyAll'),
      sendAndArchive: booleanInput(request, 'sendAndArchive', fields, true),
      autoAdvance: enumInput(request, 'autoAdvance', AUTO_ADVANCE_OPTIONS, fields, 'newer'),
      desktopNotifications: booleanInput(request, 'desktopNotifications', fields, true),
      notificationSound: enumInput(request, 'notificationSound', SOUNDS, fields, 'default'),
      notificationPreview: booleanInput(request, 'notificationPreview', fields, true),
      filters: listInput('filters'),
      blockedSenders: listInput('blockedSenders'),
      labels: listInput('labels'),
      loadRemoteImages: booleanInput(request, 'loadRemoteImages', fields, false),
      showExternalContent: booleanInput(request, 'showExternalContent', fields, false),
      vacationEnabled: booleanInput(request, 'vacationEnabled', fields, false),
      vacationStartDate: stringInput(request, 'vacationStartDate', fields),
      vacationEndDate: stringInput(request, 'vacationEndDate', fields),
      vacationSubject,
      vacationMessage,
    },
  }
}

export default new Action({
  name: 'InboxPreferenceUpdateAction',
  description: 'Creates or updates settings for the configured dashboard mailbox.',
  method: 'PUT',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const mailboxValue = request.get('mailbox')
    const mailbox = (mailboxValue === null || mailboxValue === undefined
      ? defaultMailbox()
      : typeof mailboxValue === 'string' ? mailboxValue : '')
      .trim()
      .toLowerCase()
    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(mailbox) || mailbox.length > 320)
      return response.json({ message: 'The mail settings are invalid.', fields: { mailbox: 'Enter a valid mailbox.' } }, 422)

    const { fields, input } = inputFromRequest(request, mailbox)
    if (Object.keys(fields).length)
      return response.json({ message: 'The mail settings are invalid.', fields }, 422)

    const record = await MailPreference.where('mailbox', '=', mailbox).first()
    const attributes = mailPreferenceAttributes(input)
    if (record)
      await record.update(attributes)
    else
      await MailPreference.create(attributes)

    return response.json({
      success: true,
      preference: serializeMailPreference(
        await MailPreference.where('mailbox', '=', mailbox).first(),
        mailbox,
      ),
    })
  },
})
