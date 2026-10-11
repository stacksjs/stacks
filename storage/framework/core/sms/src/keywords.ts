/**
 * The keywords a reply can carry, per language, and the replies to them.
 *
 * English is what carriers and Twilio's own opt-out handling recognise
 * (CTIA). Other languages are recognised too, because a member in Germany
 * answers "STOPP", not "STOP", and that has to stop the texts just the same.
 * Every language is checked on every message: a reply says nothing about
 * which language its sender reads, and these words do not collide.
 *
 * Pure: no database, so the compliance helpers can use it too.
 */

export type InboundSmsKind = 'stop' | 'start' | 'help' | 'message'

export interface SmsKeywordSet {
  stop: readonly string[]
  start: readonly string[]
  help: readonly string[]
}

export const SMS_KEYWORDS: Readonly<Record<string, SmsKeywordSet>> = {
  en: { stop: ['stop', 'stopall', 'unsubscribe', 'cancel', 'end', 'quit'], start: ['start', 'yes', 'unstop'], help: ['help', 'info'] },
  de: { stop: ['stopp', 'abmelden', 'abbestellen'], start: ['starten'], help: ['hilfe'] },
}

/** The keywords Twilio (and US carriers) handle themselves, replies included. */
export const PROVIDER_HANDLED_LOCALE = 'en'

export interface SmsKeywordMatch {
  kind: InboundSmsKind
  /** The language of the keyword that matched; absent for an ordinary message. */
  locale?: string
  /** The keyword, lower-cased. */
  keyword?: string
}

/** Which keyword a message is: its first word, in any case, in any language. */
export function matchSmsKeyword(body: string, locales: readonly string[] = Object.keys(SMS_KEYWORDS)): SmsKeywordMatch {
  const word = String(body ?? '').trim().toLowerCase().split(/\s+/)[0] ?? ''
  if (!word)
    return { kind: 'message' }
  for (const kind of ['stop', 'start', 'help'] as const) {
    for (const locale of locales) {
      if (SMS_KEYWORDS[locale]?.[kind].includes(word))
        return { kind, locale, keyword: word }
    }
  }
  return { kind: 'message' }
}

const REPLIES: Readonly<Record<string, Record<Exclude<InboundSmsKind, 'message'>, (name: string, contact?: string) => string>>> = {
  en: {
    stop: name => `You are unsubscribed from ${name} texts. No more messages will be sent. Reply START to resubscribe.`,
    start: name => `You are resubscribed to ${name} texts. Reply STOP to unsubscribe.`,
    help: (name, contact) => `${name}: reply STOP to unsubscribe, START to resubscribe.${contact ? ` Contact: ${contact}` : ''}`,
  },
  de: {
    stop: name => `Du bist von den SMS von ${name} abgemeldet und bekommst keine weiteren. Antworte STARTEN, um sie wieder zu erhalten.`,
    start: name => `Du bekommst wieder SMS von ${name}. Antworte STOPP zum Abmelden.`,
    help: (name, contact) => `${name}: Antworte STOPP zum Abmelden oder STARTEN zum erneuten Anmelden.${contact ? ` Kontakt: ${contact}` : ''}`,
  },
}

/** The compliance reply to a keyword in `locale` (English when there is none), or undefined for an ordinary message. */
export function inboundSmsReply(kind: InboundSmsKind, options: { appName?: string, helpContact?: string, locale?: string } = {}): string | undefined {
  if (kind === 'message')
    return undefined
  const base = String(options.locale || '').toLowerCase().split(/[-_]/)[0] ?? ''
  const copy = REPLIES[base] ?? REPLIES.en!
  const name = options.appName ?? (base === 'de' ? 'diesem Dienst' : 'this service')
  return copy[kind](name, options.helpContact)
}
