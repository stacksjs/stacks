import { TelephonyError } from './errors.ts'
import type { CallInstructions, CallStatus, NumberSearch } from './types.ts'

export function invalid(message: string): never {
  throw new TelephonyError('validation', message)
}
export function phone(value: string): string {
  // NANP includes other countries. Country availability is decided by the provider search.
  if (typeof value !== 'string' || !/^\+1[2-9]\d{2}[2-9]\d{6}$/.test(value)) invalid('Expected a North American E.164 phone number.')
  return value
}
export function sid(value: string, prefix: 'AC' | 'CA' | 'PN' | 'MZ' | 'BU' | 'AD'): string {
  if (typeof value !== 'string' || !new RegExp(`^${prefix}[a-f0-9]{32}$`, 'i').test(value)) invalid('Invalid provider resource identifier.')
  return value
}
export function secureUrl(value: string, protocol: 'https:' | 'wss:' = 'https:'): string {
  try {
    const url = new URL(value)
    if (url.protocol !== protocol || url.username || url.password || url.hash) invalid('Expected a secure public callback URL without credentials or fragment.')
    return value
  }
  catch { return invalid('Expected a secure public callback URL without credentials or fragment.') }
}
export function search(input: NumberSearch): number {
  if (input.country !== 'US' && input.country !== 'CA') invalid('Only US and Canadian number searches are supported.')
  if (input.areaCode !== undefined && !/^[2-9]\d{2}$/.test(input.areaCode)) invalid('Invalid area code.')
  const limit = input.limit ?? 20
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) invalid('Search limit must be between 1 and 50.')
  return limit
}
export function instructions(input: CallInstructions): URLSearchParams {
  if (typeof input.twiml === 'string' && input.url === undefined && input.twiml.length > 0 && input.twiml.length <= 4000) return new URLSearchParams({ Twiml: input.twiml })
  if (typeof input.url === 'string' && input.twiml === undefined) return new URLSearchParams({ Url: secureUrl(input.url), Method: 'POST' })
  return invalid('Supply exactly one callback URL or 1 to 4000 characters of trusted TwiML.')
}
export const callStatuses: readonly CallStatus[] = ['queued', 'ringing', 'in-progress', 'completed', 'busy', 'failed', 'no-answer', 'canceled']
