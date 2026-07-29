import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { MailPreference } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import {
  defaultMailbox,
  type MailPreferenceInput,
  mailPreferenceAttributes,
  serializeMailPreference,
} from './mail-preference'

const DENSITIES = new Set(['comfortable', 'default', 'compact'])
const THEMES = new Set(['light', 'dark', 'system'])
const LANGUAGES = new Set(['en', 'fr', 'de', 'es', 'ja'])
const REPLY_BEHAVIORS = new Set(['reply', 'replyAll'])
const AUTO_ADVANCE_OPTIONS = new Set(['newer', 'older', 'back'])
const SOUNDS = new Set(['default', 'subtle', 'none'])

function stringInput(request: RequestInstance, key: string, fallback = ''): string {
  const value = request.get(key)
  return value === null || value === undefined ? fallback : String(value)
}

function booleanInput(request: RequestInstance, key: string, fallback: boolean): boolean {
  const value = request.get(key)
  if (value === null || value === undefined)
    return fallback
  if (typeof value === 'string')
    return !['', '0', 'false', 'no', 'off'].includes(value.trim().toLowerCase())
  return Boolean(value)
}

function enumInput<T extends string>(request: RequestInstance, key: string, allowed: Set<string>, fallback: T): T {
  const value = stringInput(request, key, fallback)
  return (allowed.has(value) ? value : fallback) as T
}

function inputFromRequest(request: RequestInstance, mailbox: string): MailPreferenceInput {
  return {
    mailbox,
    accountName: stringInput(request, 'accountName', 'Stacks').trim(),
    signature: stringInput(request, 'signature'),
    displayDensity: enumInput(request, 'displayDensity', DENSITIES, 'default'),
    theme: enumInput(request, 'theme', THEMES, 'system'),
    language: enumInput(request, 'language', LANGUAGES, 'en'),
    defaultReplyBehavior: enumInput(request, 'defaultReplyBehavior', REPLY_BEHAVIORS, 'replyAll'),
    sendAndArchive: booleanInput(request, 'sendAndArchive', true),
    autoAdvance: enumInput(request, 'autoAdvance', AUTO_ADVANCE_OPTIONS, 'newer'),
    desktopNotifications: booleanInput(request, 'desktopNotifications', true),
    notificationSound: enumInput(request, 'notificationSound', SOUNDS, 'default'),
    notificationPreview: booleanInput(request, 'notificationPreview', true),
    filters: stringInput(request, 'filters', '[]'),
    blockedSenders: stringInput(request, 'blockedSenders', '[]'),
    labels: stringInput(request, 'labels', '[]'),
    loadRemoteImages: booleanInput(request, 'loadRemoteImages', false),
    showExternalContent: booleanInput(request, 'showExternalContent', false),
    vacationEnabled: booleanInput(request, 'vacationEnabled', false),
    vacationStartDate: stringInput(request, 'vacationStartDate'),
    vacationEndDate: stringInput(request, 'vacationEndDate'),
    vacationSubject: stringInput(request, 'vacationSubject'),
    vacationMessage: stringInput(request, 'vacationMessage'),
  }
}

export default new Action({
  name: 'InboxPreferenceUpdateAction',
  description: 'Creates or updates settings for the configured dashboard mailbox.',
  method: 'PUT',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const mailbox = String(request.get('mailbox') || defaultMailbox()).trim().toLowerCase()
    if (!mailbox || !mailbox.includes('@'))
      return response.json({ message: 'A valid mailbox is required.' }, 422)

    const input = inputFromRequest(request, mailbox)
    if (!input.accountName)
      return response.json({ message: 'Account name is required.' }, 422)

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
