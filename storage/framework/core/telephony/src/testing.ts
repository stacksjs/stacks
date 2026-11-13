import { TelephonyError } from './errors.ts'
import { MemoryOperationJournal } from './journal.ts'
import type { OperationJournal } from './journal.ts'
import { TwilioTelephony } from './twilio.ts'
import type { AvailableNumber, Call, CallStatus, PhoneNumber } from './types.ts'
import { callStatuses, phone } from './validation.ts'

export interface FakeTelephonyOptions { availableNumbers?: AvailableNumber[], journal?: OperationJournal }
interface FakeState {
  available: AvailableNumber[]
  numbers: Map<string, PhoneNumber>
  calls: Map<string, Call>
  sequence: number
  failure?: 'before-request' | 'after-write' | 'rejected'
}
function nextSid(state: FakeState, prefix: string): string { return `${prefix}${(++state.sequence).toString(16).padStart(32, '0')}` }
function callJson(call: Call): Record<string, string> { return { ...call, sid: call.sid } }
function numberJson(number: PhoneNumber): Record<string, string | null> { return { sid: number.sid, phone_number: number.phoneNumber, voice_url: number.voiceUrl } }
function notFound(): Response { return Response.json({ code: 20404 }, { status: 404 }) }

function respond(state: FakeState, url: URL, method: string, params: URLSearchParams): Response {
  const path = url.pathname.split('/').slice(4).join('/')
  if (method === 'GET' && path.startsWith('AvailablePhoneNumbers/')) {
    const country = path.split('/')[1]
    const available = state.available.filter(number => number.country === country && ![...state.numbers.values()].some(owned => owned.phoneNumber === number.phoneNumber) && (!url.searchParams.has('AreaCode') || number.phoneNumber.slice(2, 5) === url.searchParams.get('AreaCode'))).slice(0, Number(url.searchParams.get('PageSize') ?? 20))
    return Response.json({ available_phone_numbers: available.map(number => ({ phone_number: number.phoneNumber, iso_country: number.country, locality: number.locality, region: number.region, capabilities: { voice: number.voice, SMS: number.sms } })) })
  }
  if (path === 'IncomingPhoneNumbers.json') {
    if (method === 'GET') return Response.json({ incoming_phone_numbers: [...state.numbers.values()].filter(number => !url.searchParams.has('PhoneNumber') || number.phoneNumber === url.searchParams.get('PhoneNumber')).slice(0, 50).map(numberJson) })
    const selected = params.get('PhoneNumber')!
    if (!state.available.some(number => number.phoneNumber === selected) || [...state.numbers.values()].some(number => number.phoneNumber === selected)) return Response.json({}, { status: 400 })
    const number = { sid: nextSid(state, 'PN'), phoneNumber: selected, voiceUrl: params.get('VoiceUrl') }
    state.numbers.set(number.sid, number)
    return Response.json(numberJson(number), { status: 201 })
  }
  if (path.startsWith('IncomingPhoneNumbers/')) {
    const numberSid = path.split('/')[1]!.replace('.json', '')
    const number = state.numbers.get(numberSid)
    if (!number) return notFound()
    if (method === 'DELETE') { state.numbers.delete(numberSid); return new Response(null, { status: 204 }) }
    number.voiceUrl = params.get('VoiceUrl')
    return Response.json(numberJson(number))
  }
  if (path === 'Calls.json') {
    if (method === 'GET') return Response.json({ calls: [...state.calls.values()].filter(call => (!url.searchParams.has('To') || call.to === url.searchParams.get('To')) && (!url.searchParams.has('From') || call.from === url.searchParams.get('From'))).slice(0, 50).map(callJson) })
    // Simulate the verified caller-ID requirement rather than accepting arbitrary outbound sources.
    if (![...state.numbers.values()].some(number => number.phoneNumber === params.get('From'))) return Response.json({}, { status: 400 })
    const call: Call = { sid: nextSid(state, 'CA'), from: params.get('From')!, to: params.get('To')!, status: 'queued', direction: 'outbound-api' }
    state.calls.set(call.sid, call)
    return Response.json(callJson(call), { status: 201 })
  }
  if (path.startsWith('Calls/')) {
    const callSid = path.split('/')[1]!.replace('.json', '')
    const call = state.calls.get(callSid)
    if (!call) return notFound()
    if (method === 'POST') {
      if (['completed', 'busy', 'failed', 'no-answer', 'canceled'].includes(call.status)) return Response.json({}, { status: 400 })
      if (params.has('Status')) call.status = params.get('Status') as CallStatus
      else call.status = 'in-progress'
    }
    return Response.json(callJson(call))
  }
  return notFound()
}

/** Deterministic in-memory provider, routed through the real adapter's validation/journal/HTTP contracts. Never uses the network. */
export class FakeTelephony extends TwilioTelephony {
  readonly mode: 'fake' = 'fake'
  private readonly state: FakeState
  constructor(options: FakeTelephonyOptions = {}) {
    const state: FakeState = {
      available: structuredClone(options.availableNumbers ?? [
        { phoneNumber: '+14155550100', country: 'US', voice: true, sms: true },
        { phoneNumber: '+16135550100', country: 'CA', voice: true, sms: true },
      ]),
      numbers: new Map(),
      calls: new Map(),
      sequence: 0,
    }
    super({
      accountSid: `AC${'0'.repeat(32)}`,
      authToken: 'fake-only',
      journal: options.journal ?? new MemoryOperationJournal(),
      fetch: async (url, init) => {
        const failure = state.failure
        state.failure = undefined
        if (failure === 'before-request') throw new Error('Simulated transport loss')
        if (failure === 'rejected') return Response.json({}, { status: 400 })
        const method = init?.method ?? 'GET'
        const response = respond(state, new URL(url), method, new URLSearchParams(String(init?.body ?? '')))
        if (failure === 'after-write' && method !== 'GET' && response.ok) throw new Error('Simulated lost response after commit')
        return response
      },
    })
    this.state = state
  }

  failNext(mode: 'before-request' | 'after-write' | 'rejected'): void { this.state.failure = mode }
  receiveCall(input: { from: string, to: string }): Call {
    phone(input.from)
    phone(input.to)
    if (![...this.state.numbers.values()].some(number => number.phoneNumber === input.to)) throw new TelephonyError('not_found', 'The fake destination number has not been provisioned.')
    const call: Call = { sid: nextSid(this.state, 'CA'), from: input.from, to: input.to, status: 'ringing', direction: 'inbound' }
    this.state.calls.set(call.sid, call)
    return structuredClone(call)
  }

  /** Explicit simulation only; a fake does not advance the call lifecycle on a timer. */
  setCallStatus(callSid: string, status: CallStatus): void {
    const call = this.state.calls.get(callSid)
    if (!call) throw new TelephonyError('not_found', 'Fake call was not found.')
    if (!callStatuses.includes(status)) throw new TelephonyError('validation', 'Invalid fake call status.')
    call.status = status
  }
}
