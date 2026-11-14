import { describe, expect, it } from 'bun:test'
import { TwilioDriver, twilioPriceMicros } from '../src/drivers/twilio'
import { WhatsAppCloudClient } from '../src/whatsapp-cloud'

const SID = `SM${'a'.repeat(32)}`
function transport(handler: (url: string, init: RequestInit) => Response | Promise<Response>): typeof fetch {
  return ((input: RequestInfo | URL, init?: RequestInit) => Promise.resolve(handler(String(input), init ?? {}))) as typeof fetch
}
const account = { accountSid: `AC${'b'.repeat(32)}`, authToken: 'tenant-token', from: '+12065550100' }

describe('Twilio exact receipts and safe retry', () => {
  it('serializes account-local credentials and retains fractional provider price without cent rounding', async () => {
    let calls = 0
    const driver = new TwilioDriver(account, undefined, { fetch: transport((url, init) => {
      calls++
      expect(url).toStartWith(`https://api.twilio.com/2010-04-01/Accounts/${account.accountSid}/Messages`)
      expect(new Headers(init.headers).get('authorization')).toBe(`Basic ${btoa(`${account.accountSid}:tenant-token`)}`)
      if (init.method === 'POST') {
        expect(new URLSearchParams(String(init.body)).get('StatusCallback')).toBe('https://support.test/callback/operation-id')
        return Response.json({ sid: SID, status: 'queued', to: '+12065550101', num_segments: '1', price: null, price_unit: 'USD' }, { status: 201 })
      }
      return Response.json({ sid: SID, status: 'delivered', price: '-0.007900', price_unit: 'USD', num_segments: '1' })
    }) })
    const result = await driver.send({ to: '+12065550101', body: 'hello', statusCallback: 'https://support.test/callback/operation-id' })
    expect(result).toMatchObject({ success: true, outcome: 'accepted', messageId: SID })
    expect(result.priceMicros).toBeUndefined()
    expect(await driver.getReceipt(SID)).toMatchObject({ messageId: SID, status: 'delivered', priceMicros: 7900, currency: 'USD' })
    expect(calls).toBe(2)
    expect(twilioPriceMicros('-0.000001')).toBe(1)
    expect(twilioPriceMicros('123.123456')).toBe(123123456)
    for (const invalid of [null, '', 'NaN', '1e3', '0.0000001', '9007199254740992'])
      expect(twilioPriceMicros(invalid)).toBeUndefined()
  })

  it('uses approved WhatsApp Content SID fields without mixing Body or MediaUrl', async () => {
    const contentSid = `HX${'c'.repeat(32)}`, senderSid = `XE${'d'.repeat(32)}`
    let posts = 0
    const driver = new TwilioDriver({ ...account, from: 'whatsapp:+12065550100' }, undefined, { fetch: transport((url, init) => {
      if (url.includes('/ApprovalRequests'))
        return Response.json({ sid: contentSid, account_sid: account.accountSid, whatsapp: { status: 'approved', category: 'UTILITY' } })
      if (url.includes('/Channels/Senders/'))
        return Response.json({ sid: senderSid, sender_id: 'whatsapp:+12065550100', status: 'ONLINE', webhook: { callback_url: 'https://support.test/incoming' } })
      posts++
      const form = new URLSearchParams(String(init.body))
      expect(form.get('To')).toBe('whatsapp:+12065550101')
      expect(form.get('From')).toBe('whatsapp:+12065550100')
      expect(form.get('ContentSid')).toBe(contentSid)
      expect(form.get('ContentVariables')).toBe('{"1":"Chris"}')
      expect(form.has('Body')).toBe(false)
      expect(form.has('MediaUrl')).toBe(false)
      return Response.json({ sid: SID, status: 'queued' }, { status: 201 })
    }) })
    expect((await driver.getWhatsAppSender(senderSid)).status).toBe('ONLINE')
    expect((await driver.getContentApproval(contentSid)).status).toBe('approved')
    expect((await driver.send({ to: 'whatsapp:+12065550101', body: 'local audit rendering', options: { contentSid, contentVariables: { 1: 'Chris' } } })).outcome).toBe('accepted')
    expect((await driver.send({ to: 'whatsapp:+12065550101', body: '', mediaUrls: ['https://support.test/a.png'], options: { contentSid } })).outcome).toBe('rejected')
    expect(posts).toBe(1)
  })

  it('does not retry message creation after a 503, malformed success or lost acknowledgement', async () => {
    for (const response of [() => new Response(null, { status: 503 }), () => new Response('{'), () => { throw new Error('socket closed') }]) {
      let calls = 0
      const driver = new TwilioDriver(account, undefined, { maxRetries: 3, fetch: transport(() => { calls++; return response() }) })
      const result = await driver.send({ to: '+12065550101', body: 'hello' })
      expect(result.outcome).toBe('unknown')
      expect(calls).toBe(1)
    }
  })

  it('retries an explicit 429 rejection and distinguishes a definitive rejection', async () => {
    let calls = 0
    const driver = new TwilioDriver(account, undefined, { fetch: transport(() => ++calls === 1
      ? new Response(null, { status: 429, headers: { 'retry-after': '0' } })
      : Response.json({ code: 21610, message: 'Opted out' }, { status: 400 })) })
    expect(await driver.send({ to: '+12065550101', body: 'hello' })).toMatchObject({ success: false, outcome: 'rejected', providerCode: 21610 })
    expect(calls).toBe(2)
  })
})

describe('WhatsApp Cloud native text transport', () => {
  it('verifies the configured phone ID and sends exact session text with opaque callback correlation', async () => {
    const client = new WhatsAppCloudClient({ phoneNumberId: '123', accessToken: 'tenant-token', apiVersion: 'v27.0' }, { fetch: transport((url, init) => {
      expect(new Headers(init.headers).get('authorization')).toBe('Bearer tenant-token')
      if (init.method !== 'POST')
        return Response.json({ id: '123', display_phone_number: '+12065550100', verified_name: 'Support' })
      expect(url).toBe('https://graph.facebook.com/v27.0/123/messages')
      expect(JSON.parse(String(init.body))).toEqual({ messaging_product: 'whatsapp', recipient_type: 'individual', to: '12065550101', type: 'text', text: { preview_url: false, body: 'hello' }, biz_opaque_callback_data: 'operation-id' })
      return Response.json({ messages: [{ id: 'wamid.receipt' }] })
    }) })
    expect((await client.identity()).id).toBe('123')
    expect(await client.sendText('+12065550101', 'hello', { callbackData: 'operation-id' })).toMatchObject({ outcome: 'accepted', messageId: 'wamid.receipt' })
  })

  it('does not retry ambiguous failures and validates recipient/body before the network', async () => {
    let calls = 0
    const client = new WhatsAppCloudClient({ phoneNumberId: '123', accessToken: 'token', apiVersion: 'v27.0' }, { fetch: transport(() => { calls++; throw new Error('lost ACK') }) })
    expect((await client.sendText('12065550101', 'hello')).outcome).toBe('unknown')
    expect((await client.sendText('recipient/path', 'hello')).outcome).toBe('rejected')
    expect((await client.sendText('12065550101', 'x'.repeat(4097))).outcome).toBe('rejected')
    expect(calls).toBe(1)
  })
})
