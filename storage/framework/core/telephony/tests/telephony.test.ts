import { expect, test } from 'bun:test'
import { MemoryOperationJournal, TwilioTelephony } from '../src/index.ts'

const accountSid = `AC${'a'.repeat(32)}`
const numberSid = `PN${'b'.repeat(32)}`
const callSid = `CA${'c'.repeat(32)}`
const number = { sid: numberSid, phone_number: '+14155550100', voice_url: 'https://app.example/voice' }
const call = { sid: callSid, from: '+14155550100', to: '+16135550100', status: 'queued', direction: 'outbound-api' }

test('uses Twilio REST forms for a US/Canada search, provision and outbound call; replays one operation once', async () => {
  const requests: { url: URL, init?: RequestInit }[] = []
  const provider = new TwilioTelephony({ accountSid, authToken: 'test-only', journal: new MemoryOperationJournal(), fetch: async (url, init) => {
    requests.push({ url: new URL(String(url)), init })
    if (String(url).includes('AvailablePhoneNumbers')) return Response.json({ available_phone_numbers: [{ phone_number: '+14155550100', iso_country: 'US', capabilities: { voice: true, SMS: true } }] })
    return Response.json(String(url).includes('Calls') ? call : number, { status: 201 })
  } })
  expect((await provider.searchNumbers({ country: 'US', areaCode: '415', limit: 1 }))[0]?.voice).toBe(true)
  expect(requests[0]?.url.pathname).toBe(`/2010-04-01/Accounts/${accountSid}/AvailablePhoneNumbers/US/Local.json`)
  expect(requests[0]?.url.searchParams.get('VoiceEnabled')).toBe('true')
  const input = { phoneNumber: '+14155550100', voiceUrl: 'https://app.example/voice' }
  expect((await provider.provisionNumber(input, { operationKey: 'purchase:1' })).sid).toBe(numberSid)
  await provider.provisionNumber(input, { operationKey: 'purchase:1' })
  expect(requests).toHaveLength(2)
  expect(new URLSearchParams(String(requests[1]?.init?.body)).get('VoiceMethod')).toBe('POST')
  expect((await provider.createCall({ from: call.from, to: call.to, twiml: '<Response><Hangup/></Response>' }, { operationKey: 'call:1' })).status).toBe('queued')
  expect(new URLSearchParams(String(requests[2]?.init?.body)).get('Twiml')).toBe('<Response><Hangup/></Response>')
})

test('an ambiguous write stays blocked even across adapter instances sharing a journal', async () => {
  const journal = new MemoryOperationJournal()
  let attempts = 0
  const options = { accountSid, authToken: 'secret-must-not-leak', journal, fetch: async () => { attempts++; throw new Error('secret-must-not-leak') } }
  const input = { from: call.from, to: call.to, twiml: '<Response><Hangup/></Response>' }
  await expect(new TwilioTelephony(options).createCall(input, { operationKey: 'uncertain' })).rejects.toMatchObject({ code: 'write_uncertain' })
  await expect(new TwilioTelephony(options).createCall(input, { operationKey: 'uncertain' })).rejects.toMatchObject({ code: 'write_uncertain' })
  expect(attempts).toBe(1)
  await expect(new TwilioTelephony(options).createCall({ ...input, to: '+16135550101' }, { operationKey: 'uncertain' })).rejects.toMatchObject({ code: 'operation_conflict' })
})

test('blocks concurrent duplicate writes while the first provider request is pending', async () => {
  let finish!: (response: Response) => void
  let started!: () => void
  const ready = new Promise<void>(resolve => { started = resolve })
  const provider = new TwilioTelephony({ accountSid, authToken: 'test-only', journal: new MemoryOperationJournal(), fetch: async () => {
    started()
    return new Promise<Response>(resolve => { finish = resolve })
  } })
  const input = { phoneNumber: '+14155550100', voiceUrl: 'https://app.example/voice' }
  const pending = provider.provisionNumber(input, { operationKey: 'concurrent' })
  await ready
  await expect(provider.provisionNumber(input, { operationKey: 'concurrent' })).rejects.toMatchObject({ code: 'operation_pending' })
  finish(Response.json(number))
  await pending
})

test('provider rejection remains rejected and never leaks the provider body or retries', async () => {
  let requests = 0
  const provider = new TwilioTelephony({ accountSid, authToken: 'test-only', journal: new MemoryOperationJournal(), fetch: async () => {
    requests++
    return Response.json({ message: 'private credentials and caller details' }, { status: 429 })
  } })
  for (let i = 0; i < 2; i++) {
    try { await provider.releaseNumber(numberSid, { operationKey: 'rate-limit' }); throw new Error('Expected failure') }
    catch (error) {
      expect(error).toMatchObject({ code: 'rate_limited', details: { status: 429 } })
      expect(String(error)).not.toContain('private')
    }
  }
  expect(requests).toBe(1)
})

test('server failure, timeout and malformed successful writes all require reconciliation', async () => {
  for (const response of [new Response('private', { status: 503 }), Response.json({ sid: 'invalid' }), new Response('no-json', { status: 201 })]) {
    const provider = new TwilioTelephony({ accountSid, authToken: 'test-only', journal: new MemoryOperationJournal(), fetch: async () => response })
    await expect(provider.createCall({ from: call.from, to: call.to, url: 'https://app.example/voice' }, { operationKey: 'unsafe' })).rejects.toMatchObject({ code: 'write_uncertain' })
  }
  const provider = new TwilioTelephony({ accountSid, authToken: 'test-only', journal: new MemoryOperationJournal(), timeoutMs: 1, fetch: async (url, init) => {
    await new Promise((resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))))
    return Response.json(call)
  } })
  await expect(provider.createCall({ from: call.from, to: call.to, url: 'https://app.example/voice' }, { operationKey: 'timeout' })).rejects.toMatchObject({ code: 'write_uncertain' })
})

test('validates requests before sending and bounds provider JSON', async () => {
  let requests = 0
  const provider = new TwilioTelephony({ accountSid, authToken: 'test-only', journal: new MemoryOperationJournal(), fetch: async () => { requests++; return new Response('x'.repeat(1048577)) } })
  await expect(provider.searchNumbers({ country: 'GB' as 'US' })).rejects.toMatchObject({ code: 'validation' })
  await expect(provider.provisionNumber({ phoneNumber: '911', voiceUrl: 'https://app.example/voice' }, { operationKey: 'invalid' })).rejects.toMatchObject({ code: 'validation' })
  await expect(provider.redirectCall(callSid, { url: 'http://app.example/voice' }, { operationKey: 'invalid' })).rejects.toMatchObject({ code: 'validation' })
  expect(requests).toBe(0)
  await expect(provider.getCall(callSid)).rejects.toMatchObject({ code: 'invalid_response' })
})

test('journal failures prevent a fresh request and never leak storage-driver details', async () => {
  let requests = 0
  const fetcher = async () => { requests++; return Response.json(number) }
  const input = { phoneNumber: '+14155550100', voiceUrl: 'https://app.example/voice' }
  const unavailable = new TwilioTelephony({ accountSid, authToken: 'test-only', fetch: fetcher, journal: {
    claim: async () => { throw new Error('private database credentials') },
    settle: async () => {},
  } })
  await expect(unavailable.provisionNumber(input, { operationKey: 'claim' })).rejects.toMatchObject({ code: 'transport', message: 'Operation journal is unavailable. No provider request was sent.' })
  expect(requests).toBe(0)
  const journal = new MemoryOperationJournal()
  const unsettled = new TwilioTelephony({ accountSid, authToken: 'test-only', fetch: fetcher, journal: {
    claim: (key, fingerprint) => journal.claim(key, fingerprint),
    settle: async () => { throw new Error('private database credentials') },
  } })
  await expect(unsettled.provisionNumber(input, { operationKey: 'settle' })).rejects.toMatchObject({ code: 'write_uncertain' })
  await expect(unsettled.provisionNumber(input, { operationKey: 'settle' })).rejects.toMatchObject({ code: 'operation_pending' })
  expect(requests).toBe(1)
})

test('a full memory journal rejects a new operation while preserving previous idempotency', async () => {
  let requests = 0
  const provider = new TwilioTelephony({ accountSid, authToken: 'test-only', journal: new MemoryOperationJournal(1), fetch: async () => { requests++; return Response.json(number) } })
  const input = { phoneNumber: '+14155550100', voiceUrl: 'https://app.example/voice' }
  await provider.provisionNumber(input, { operationKey: 'first' })
  await expect(provider.provisionNumber(input, { operationKey: 'second' })).rejects.toMatchObject({ code: 'capacity' })
  expect((await provider.provisionNumber(input, { operationKey: 'first' })).sid).toBe(numberSid)
  expect(requests).toBe(1)
})
