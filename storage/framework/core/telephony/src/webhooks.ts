import { createHmac, timingSafeEqual } from 'node:crypto'
import { TelephonyError } from './errors.ts'
import type { CallStatus } from './types.ts'
import { callStatuses, sid } from './validation.ts'

export interface TwilioSignatureInput {
  /** Exact externally configured HTTPS URL, including original query order and encoding. Do not infer it from untrusted forwarded headers. */
  url: string
  /** All decoded form fields, preserving duplicates and whitespace. Empty for a WebSocket upgrade. JSON callbacks are not supported. */
  fields: URLSearchParams
  signature: string
  authToken: string
}
/** Twilio's HMAC-SHA1 form signature contract; this does not prevent replay. */
export function verifyTwilioSignature(input: TwilioSignatureInput): boolean {
  if (!input.authToken || !/^https:\/\//.test(input.url) || !/^[A-Za-z0-9+/]{27}=$/.test(input.signature)) return false
  // Repeated values follow the official twilio-node helper: unique, sorted values per name.
  let payload = input.url
  for (const key of [...new Set(input.fields.keys())].sort()) {
    for (const value of [...new Set(input.fields.getAll(key))].sort()) payload += key + value
  }
  const expected = createHmac('sha1', input.authToken).update(payload).digest()
  const actual = Buffer.from(input.signature, 'base64')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export interface VoiceWebhook {
  accountSid: string
  callSid: string
  from: string
  to: string
  status: CallStatus
  direction?: string
  sequenceNumber?: number
}

/** Verify before trusting fields. Bind the account here; bind CallSid to the application workspace before any action. */
export function parseVoiceWebhook(input: TwilioSignatureInput & { accountSid: string }): VoiceWebhook {
  if (!verifyTwilioSignature(input) || input.fields.get('AccountSid') !== input.accountSid) throw new TelephonyError('invalid_signature', 'Voice callback authentication failed.')
  const one = (key: string, required: boolean = true): string | undefined => {
    const values = input.fields.getAll(key)
    if (values.length > 1 || (required && !values[0])) throw new TelephonyError('validation', 'Voice callback fields are invalid.')
    return values[0]
  }
  const status = one('CallStatus') as CallStatus
  if (!callStatuses.includes(status)) throw new TelephonyError('validation', 'Voice callback status is invalid.')
  const sequence = one('SequenceNumber', false)
  if (sequence !== undefined && (!/^\d+$/.test(sequence) || !Number.isSafeInteger(Number(sequence)))) throw new TelephonyError('validation', 'Voice callback sequence is invalid.')
  return { accountSid: sid(one('AccountSid')!, 'AC'), callSid: sid(one('CallSid')!, 'CA'), from: one('From')!, to: one('To')!, status, direction: one('Direction', false), sequenceNumber: sequence === undefined ? undefined : Number(sequence) }
}
