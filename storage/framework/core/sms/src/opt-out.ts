import { db, sqlDateTime } from '@stacksjs/database'

/**
 * US SMS compliance: STOP must stop, START must restart, HELP must answer.
 * Carriers enforce this at the shortcode/10DLC level, but the sender is
 * still required to honor it in their own records - and a school that
 * keeps texting after STOP is one parent complaint from a filtered number.
 *
 * Opt-outs are keyed by PHONE NUMBER, not user: the reply comes from a
 * handset, and whoever holds it has spoken for it regardless of which
 * family member the CRM thinks owns it.
 *
 * Table: `sms_opt_outs` (phone unique, opted_out_at, reason).
 */

/** The exact keyword set carriers recognize, per CTIA guidelines. */
const STOP_WORDS = new Set(['stop', 'stopall', 'unsubscribe', 'cancel', 'end', 'quit'])
const START_WORDS = new Set(['start', 'yes', 'unstop'])
const HELP_WORDS = new Set(['help', 'info'])

export type InboundSmsKind = 'stop' | 'start' | 'help' | 'message'

export interface InboundSmsResult {
  kind: InboundSmsKind
  /** A reply the webhook should send back, when compliance requires one. */
  reply?: string
}

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, '')
  // Normalize bare US 10-digit to E.164 so 'STOP' from (310) 555-0199 and
  // +13105550199 land on one row.
  if (/^\d{10}$/.test(digits))
    return `+1${digits}`
  if (/^1\d{10}$/.test(digits))
    return `+${digits}`
  return digits
}

export function classifyInboundSms(body: string): InboundSmsKind {
  const word = body.trim().toLowerCase().split(/\s+/)[0] ?? ''
  if (STOP_WORDS.has(word))
    return 'stop'
  if (START_WORDS.has(word))
    return 'start'
  if (HELP_WORDS.has(word))
    return 'help'
  return 'message'
}

export async function optOutPhone(phone: string, reason = 'stop-keyword'): Promise<void> {
  const normalized = normalizePhone(phone)
  if (!normalized)
    return

  await db
    .deleteFrom('sms_opt_outs')
    .where('phone', '=', normalized)
    .execute()

  await db
    .insertInto('sms_opt_outs')
    .values({
      phone: normalized,
      reason,
      opted_out_at: sqlDateTime(new Date()),
      created_at: sqlDateTime(new Date()),
      updated_at: sqlDateTime(new Date()),
    } as never)
    .execute()
}

export async function optInPhone(phone: string): Promise<void> {
  const normalized = normalizePhone(phone)
  if (!normalized)
    return

  await db
    .deleteFrom('sms_opt_outs')
    .where('phone', '=', normalized)
    .execute()
}

/** Check before EVERY non-emergency send. */
export async function isPhoneOptedOut(phone: string): Promise<boolean> {
  const normalized = normalizePhone(phone)
  if (!normalized)
    return false

  const row = await db
    .selectFrom('sms_opt_outs')
    .where('phone', '=', normalized)
    .select(['id'])
    .executeTakeFirst()

  return !!row
}

/**
 * Process one inbound SMS (a provider webhook's job): record STOP/START,
 * return the compliance reply to send. Ordinary messages pass through as
 * `kind: 'message'` for the app to route (or ignore).
 */
export async function handleInboundSms(input: { from: string, body: string }, options: { appName?: string, helpContact?: string } = {}): Promise<InboundSmsResult> {
  const kind = classifyInboundSms(input.body)
  const name = options.appName ?? 'this service'

  switch (kind) {
    case 'stop':
      await optOutPhone(input.from)
      return { kind, reply: `You are unsubscribed from ${name} texts. No more messages will be sent. Reply START to resubscribe.` }
    case 'start':
      await optInPhone(input.from)
      return { kind, reply: `You are resubscribed to ${name} texts. Reply STOP to unsubscribe.` }
    case 'help':
      return { kind, reply: `${name}: reply STOP to unsubscribe, START to resubscribe.${options.helpContact ? ` Contact: ${options.helpContact}` : ''}` }
    default:
      return { kind }
  }
}
