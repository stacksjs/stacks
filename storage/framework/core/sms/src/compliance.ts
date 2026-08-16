import type { SmsInboundIntent, SmsInboundMessage, SmsSegmentEstimate } from '@stacksjs/types'
import { createHmac, timingSafeEqual } from 'node:crypto'

const DEFAULT_OPT_OUT = ['STOP', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT']
const DEFAULT_OPT_IN = ['START', 'UNSTOP', 'YES']
const DEFAULT_HELP = ['HELP', 'INFO']

const GSM_7_BASIC = new Set(`@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà`)
const GSM_7_EXTENDED = new Set('^{}\\[~]|€')

function normalizedKeyword(body: string): string {
  return body.trim().split(/\s+/, 1)[0]?.toUpperCase() ?? ''
}

export function classifySmsIntent(
  body: string,
  options: { optOut?: string[], optIn?: string[], help?: string[] } = {},
): { intent: SmsInboundIntent, keyword?: string } {
  const keyword = normalizedKeyword(body)
  const includes = (values: string[] | undefined, defaults: string[]): boolean =>
    (values ?? defaults).some(value => value.trim().toUpperCase() === keyword)

  if (includes(options.optOut, DEFAULT_OPT_OUT)) return { intent: 'opt-out', keyword }
  if (includes(options.optIn, DEFAULT_OPT_IN)) return { intent: 'opt-in', keyword }
  if (includes(options.help, DEFAULT_HELP)) return { intent: 'help', keyword }
  return { intent: 'message' }
}

export function smsComplianceReply(
  intent: SmsInboundIntent,
  options: { appName?: string, helpContact?: string } = {},
): string | null {
  const name = options.appName?.trim() || 'This service'
  if (intent === 'opt-out') return `${name}: you are unsubscribed. No more messages will be sent. Reply START to resubscribe.`
  if (intent === 'opt-in') return `${name}: you are resubscribed. Reply STOP to unsubscribe.`
  if (intent === 'help') return `${name}: reply STOP to unsubscribe or START to resubscribe.${options.helpContact ? ` Contact ${options.helpContact}.` : ''}`
  return null
}

export function parseTwilioInbound(
  fields: Record<string, string | undefined>,
  options: { optOut?: string[], optIn?: string[], help?: string[] } = {},
): SmsInboundMessage {
  const body = fields.Body ?? ''
  return {
    from: fields.From ?? '',
    to: fields.To ?? '',
    body,
    messageId: fields.MessageSid ?? fields.SmsSid,
    ...classifySmsIntent(body, options),
  }
}

export function verifyTwilioWebhook(
  url: string,
  fields: Record<string, string | undefined>,
  signature: string,
  authToken: string,
): boolean {
  if (!url || !signature || !authToken) return false
  const payload = Object.keys(fields)
    .sort()
    .reduce((value, key) => `${value}${key}${fields[key] ?? ''}`, url)
  const expected = createHmac('sha1', authToken).update(payload).digest('base64')
  const expectedBuffer = Buffer.from(expected)
  const actualBuffer = Buffer.from(signature)
  if (expectedBuffer.length !== actualBuffer.length) {
    timingSafeEqual(expectedBuffer, expectedBuffer)
    return false
  }
  return timingSafeEqual(expectedBuffer, actualBuffer)
}

export function estimateSmsSegments(body: string): SmsSegmentEstimate {
  let septets = 0
  let gsm7 = true
  for (const character of body) {
    if (GSM_7_BASIC.has(character)) septets += 1
    else if (GSM_7_EXTENDED.has(character)) septets += 2
    else {
      gsm7 = false
      break
    }
  }

  if (gsm7) {
    const perSegment = septets <= 160 ? 160 : 153
    return { encoding: 'gsm-7', characters: body.length, segments: Math.max(1, Math.ceil(septets / perSegment)), perSegment }
  }

  const characters = [...body].length
  const perSegment = characters <= 70 ? 70 : 67
  return { encoding: 'ucs-2', characters, segments: Math.max(1, Math.ceil(characters / perSegment)), perSegment }
}

export function isWithinSmsQuietHours(
  at: Date,
  options: { startHour: number, endHour: number, timezone?: string },
): boolean {
  const hour = Number(new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hourCycle: 'h23',
    timeZone: options.timezone ?? 'UTC',
  }).format(at))
  const start = Math.min(23, Math.max(0, Math.floor(options.startHour)))
  const end = Math.min(23, Math.max(0, Math.floor(options.endHour)))
  if (start === end) return true
  return start < end ? hour >= start && hour < end : hour >= start || hour < end
}
