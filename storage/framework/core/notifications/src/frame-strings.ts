import { resolveNotificationLocale } from './templates'

/**
 * The fixed words around a notification: the email's footer lines, its
 * unsubscribe links, the button label used when the action names none, and
 * the line a marketing text ends with. The message itself (subject, body,
 * button) is the caller's; these are the frame's.
 *
 * `{app}` is replaced by the app's name and `{year}` by the current year.
 * Single braces, because the frame template fills them in and `{{ }}` is stx's
 * own syntax there.
 */
export interface NotificationFrameStrings {
  /** The email footer without unsubscribe links (transactional mail). */
  automatedNotice: string
  /** The copyright line, after the © sign. */
  copyright: string
  /** The email footer sentence with unsubscribe links, unless the payload's `unsubscribe.notice` names its own. */
  unsubscribeNotice: string
  /** The unsubscribe link's label, in the footer and in the plain-text part. */
  unsubscribe: string
  /** The preferences link's label, beside Unsubscribe. */
  preferences: string
  /** The button's label when the action has none. */
  action: string
  /**
   * The line a marketing text ends with. Keep the keyword STOP: it is the one
   * every carrier and provider honours, whatever the language around it.
   */
  smsOptOut: string
}

/**
 * The frame in every language Stacks ships. English is what every email and
 * text said before the frame could be localized, word for word.
 */
export const NOTIFICATION_FRAME_STRINGS: Readonly<Record<'en' | 'de', Readonly<NotificationFrameStrings>>> = Object.freeze({
  en: Object.freeze({
    automatedNotice: 'This is an automated message from {app}. Please do not reply to this email.',
    copyright: '{year} {app}. All rights reserved.',
    unsubscribeNotice: 'You are receiving this because these emails are turned on in your settings.',
    unsubscribe: 'Unsubscribe',
    preferences: 'Email preferences',
    action: 'Open',
    smsOptOut: 'Reply STOP to opt out.',
  }),
  de: Object.freeze({
    automatedNotice: 'Diese Nachricht wurde automatisch von {app} verschickt. Bitte antworte nicht auf diese E-Mail.',
    copyright: '{year} {app}. Alle Rechte vorbehalten.',
    unsubscribeNotice: 'Du erhältst diese E-Mail, weil diese E-Mails in deinen Einstellungen aktiviert sind.',
    unsubscribe: 'Abmelden',
    preferences: 'E-Mail-Einstellungen',
    action: 'Öffnen',
    smsOptOut: 'Antworte STOP zum Abbestellen.',
  }),
})

/**
 * The frame for one reader: the built-in language closest to `locale` (`de-AT`
 * is `de`, anything without one is `en`), with `overrides` on top. An app
 * that speaks a language Stacks does not ship passes the whole set as
 * `overrides`; a key it leaves out (or leaves empty) stays English.
 */
export function notificationFrameStrings(locale?: string | null, overrides?: Partial<NotificationFrameStrings> | null): NotificationFrameStrings {
  const language = resolveNotificationLocale(Object.keys(NOTIFICATION_FRAME_STRINGS), locale, 'en') as keyof typeof NOTIFICATION_FRAME_STRINGS
  const strings: NotificationFrameStrings = { ...NOTIFICATION_FRAME_STRINGS[language] }
  for (const [key, value] of Object.entries(overrides ?? {})) {
    if (key in strings && typeof value === 'string' && value.trim())
      strings[key as keyof NotificationFrameStrings] = value
  }
  return strings
}

const LANGUAGE_TAG = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i

/** The email's `<html lang>`: the reader's language tag as given, `en` when there is none (or it is not one). */
export function notificationLanguageTag(locale?: string | null): string {
  const tag = String(locale ?? '').trim().replace(/_/g, '-')
  return LANGUAGE_TAG.test(tag) ? tag : 'en'
}
