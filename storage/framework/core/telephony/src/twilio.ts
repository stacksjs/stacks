import { TelephonyError } from './errors.ts'
import type { OperationJournal } from './journal.ts'
import { executeWrite } from './journal.ts'
import type { AvailableNumber, Call, CallInstructions, CallStatus, CreateCall, NumberSearch, PhoneNumber, ProvisionNumber, Telephony, WriteOptions } from './types.ts'
import { callStatuses, instructions, invalid, phone, search, secureUrl, sid } from './validation.ts'

export type TelephonyFetch = (url: string, init?: RequestInit) => Promise<Response>
export interface TwilioTelephonyOptions {
  accountSid: string
  authToken: string
  /** Required so applications consciously choose durable or process-local semantics. */
  journal: OperationJournal
  fetch?: TelephonyFetch
  timeoutMs?: number
}

function badResponse(): never {
  throw new TelephonyError('invalid_response', 'Provider returned an invalid response.')
}
function object(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || !value || Array.isArray(value)) badResponse()
  return value as Record<string, unknown>
}
function text(value: unknown): string {
  if (typeof value !== 'string') badResponse()
  return value
}
function resourceSid(value: unknown, prefix: string): string {
  const result = text(value)
  if (!new RegExp(`^${prefix}[a-f0-9]{32}$`, 'i').test(result)) badResponse()
  return result
}
function numberResult(value: unknown): PhoneNumber {
  const row = object(value)
  return { sid: resourceSid(row.sid, 'PN'), phoneNumber: text(row.phone_number), voiceUrl: row.voice_url == null ? null : text(row.voice_url) }
}
function callResult(value: unknown): Call {
  const row = object(value)
  if (!callStatuses.includes(row.status as CallStatus)) badResponse()
  return { sid: resourceSid(row.sid, 'CA'), from: text(row.from), to: text(row.to), status: row.status as CallStatus, direction: text(row.direction) }
}
function rows(value: unknown, key: string): unknown[] {
  const list = object(value)[key]
  if (!Array.isArray(list) || list.length > 50) badResponse()
  return list
}

/** Server-only adapter. No network work at construction, retries, purchases or calls without an explicit method call. */
export class TwilioTelephony implements Telephony {
  private readonly account: string
  private readonly auth: string
  private readonly journal: OperationJournal
  private readonly fetcher: TelephonyFetch
  private readonly timeoutMs: number

  constructor(options: TwilioTelephonyOptions) {
    if (!options.authToken || !/^AC[a-f0-9]{32}$/i.test(options.accountSid)) throw new TelephonyError('configuration', 'Twilio account credentials are required.')
    if (!options.journal) throw new TelephonyError('configuration', 'An operation journal is required.')
    const timeout = options.timeoutMs ?? 10000
    if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > 120000) throw new TelephonyError('configuration', 'Timeout must be between 1 and 120000 milliseconds.')
    this.account = options.accountSid
    this.auth = `Basic ${Buffer.from(`${options.accountSid}:${options.authToken}`).toString('base64')}`
    this.journal = options.journal
    this.fetcher = options.fetch ?? globalThis.fetch
    this.timeoutMs = timeout
  }

  private async request(path: string, method: 'GET' | 'POST' | 'DELETE', params?: URLSearchParams): Promise<unknown> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.account}/${path}${method === 'GET' && params ? `?${params}` : ''}`
      const response = await this.fetcher(url, {
        method,
        headers: { Authorization: this.auth, ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
        body: method === 'POST' ? params?.toString() : undefined,
        redirect: 'error',
        signal: controller.signal,
      })
      if (!response.ok) {
        // Never include a provider body: it may echo phone numbers, TwiML or credentials.
        await response.body?.cancel()
        const code = response.status === 401 || response.status === 403 ? 'authentication'
          : response.status === 404 ? 'not_found'
            : response.status === 429 ? 'rate_limited'
              : response.status >= 400 && response.status < 500 && response.status !== 408 ? 'rejected' : 'transport'
        throw new TelephonyError(code, 'Twilio request failed.', { status: response.status })
      }
      if (method === 'DELETE' && response.status === 204) return undefined
      // Bound provider responses before JSON allocation; also keep the timeout through body reading.
      if (!response.body) badResponse()
      const reader = response.body.getReader()
      const chunks: Uint8Array[] = []
      let size = 0
      try {
        for (;;) {
          const chunk = await reader.read()
          if (chunk.done) break
          size += chunk.value.byteLength
          if (size > 1048576) {
            await reader.cancel()
            badResponse()
          }
          chunks.push(chunk.value)
        }
      }
      finally { reader.releaseLock() }
      try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) }
      catch { return badResponse() }
    }
    catch (error) {
      if (error instanceof TelephonyError) throw error
      throw new TelephonyError('transport', 'Twilio transport failed or timed out.')
    }
    finally { clearTimeout(timeout) }
  }

  private async write<T>(path: string, method: 'POST' | 'DELETE', params: URLSearchParams, options: WriteOptions, parse: (value: unknown) => T): Promise<T> {
    return executeWrite(this.journal, `twilio:${this.account}`, `${method}\n${path}\n${params}`, options, async () => parse(await this.request(path, method, params)))
  }

  async searchNumbers(input: NumberSearch): Promise<AvailableNumber[]> {
    const limit = search(input)
    const query = new URLSearchParams({ VoiceEnabled: 'true', PageSize: String(limit) })
    if (input.areaCode) query.set('AreaCode', input.areaCode)
    return rows(await this.request(`AvailablePhoneNumbers/${input.country}/Local.json`, 'GET', query), 'available_phone_numbers').map((value) => {
      const row = object(value)
      if (row.iso_country !== input.country) badResponse()
      const capabilities = object(row.capabilities)
      if (typeof capabilities.voice !== 'boolean' || typeof capabilities.SMS !== 'boolean') badResponse()
      return { phoneNumber: text(row.phone_number), country: input.country, locality: typeof row.locality === 'string' ? row.locality : undefined, region: typeof row.region === 'string' ? row.region : undefined, voice: capabilities.voice, sms: capabilities.SMS }
    })
  }

  /** First page, max 50. Use the exact phone filter to reconcile a provision operation. */
  async listNumbers(phoneNumber?: string): Promise<PhoneNumber[]> {
    const query = new URLSearchParams({ PageSize: '50' })
    if (phoneNumber) query.set('PhoneNumber', phone(phoneNumber))
    return rows(await this.request('IncomingPhoneNumbers.json', 'GET', query), 'incoming_phone_numbers').map(numberResult)
  }

  async provisionNumber(input: ProvisionNumber, options: WriteOptions): Promise<PhoneNumber> {
    const params = new URLSearchParams({ PhoneNumber: phone(input.phoneNumber), VoiceUrl: secureUrl(input.voiceUrl), VoiceMethod: 'POST' })
    if (input.statusCallback) { params.set('StatusCallback', secureUrl(input.statusCallback)); params.set('StatusCallbackMethod', 'POST') }
    if (input.bundleSid) params.set('BundleSid', sid(input.bundleSid, 'BU'))
    if (input.addressSid) params.set('AddressSid', sid(input.addressSid, 'AD'))
    return this.write('IncomingPhoneNumbers.json', 'POST', params, options, numberResult)
  }

  async configureNumber(numberSid: string, voiceUrl: string, options: WriteOptions): Promise<PhoneNumber> {
    return this.write(`IncomingPhoneNumbers/${sid(numberSid, 'PN')}.json`, 'POST', new URLSearchParams({ VoiceUrl: secureUrl(voiceUrl), VoiceMethod: 'POST' }), options, numberResult)
  }

  async releaseNumber(numberSid: string, options: WriteOptions): Promise<void> {
    return this.write(`IncomingPhoneNumbers/${sid(numberSid, 'PN')}.json`, 'DELETE', new URLSearchParams(), options, (value) => {
      if (value !== undefined) badResponse()
    })
  }

  async createCall(input: CreateCall, options: WriteOptions): Promise<Call> {
    const params = instructions(input)
    params.set('From', phone(input.from))
    params.set('To', phone(input.to))
    if (input.statusCallback) {
      params.set('StatusCallback', secureUrl(input.statusCallback))
      params.set('StatusCallbackMethod', 'POST')
      for (const event of ['initiated', 'ringing', 'answered', 'completed']) params.append('StatusCallbackEvent', event)
    }
    return this.write('Calls.json', 'POST', params, options, callResult)
  }

  async getCall(callSid: string): Promise<Call> {
    return callResult(await this.request(`Calls/${sid(callSid, 'CA')}.json`, 'GET'))
  }

  /** First page, max 50. Results can lag a write and do not prove an absent call was never created. */
  async listCalls(filter: { from?: string, to?: string } = {}): Promise<Call[]> {
    const query = new URLSearchParams({ PageSize: '50' })
    if (filter.from) query.set('From', phone(filter.from))
    if (filter.to) query.set('To', phone(filter.to))
    return rows(await this.request('Calls.json', 'GET', query), 'calls').map(callResult)
  }

  async redirectCall(callSid: string, input: CallInstructions, options: WriteOptions): Promise<Call> {
    return this.write(`Calls/${sid(callSid, 'CA')}.json`, 'POST', instructions(input), options, callResult)
  }

  async endCall(callSid: string, status: 'completed' | 'canceled', options: WriteOptions): Promise<Call> {
    if (status !== 'completed' && status !== 'canceled') invalid('End-call status must be completed or canceled.')
    return this.write(`Calls/${sid(callSid, 'CA')}.json`, 'POST', new URLSearchParams({ Status: status }), options, callResult)
  }
}
