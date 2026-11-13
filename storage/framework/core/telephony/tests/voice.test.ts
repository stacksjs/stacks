import { expect, test } from 'bun:test'
import { createHmac } from 'node:crypto'
import { parseVoiceWebhook, verifyTwilioSignature, voiceResponse } from '../src/index.ts'

// Published Twilio HMAC-SHA1 example, not computed by the implementation under test.
test('verifies the official signature vector against the exact public URL and all fields', () => {
  const fields = new URLSearchParams({ CallSid: 'CA1234567890ABCDE', Caller: '+14158675310', Digits: '1234', From: '+14158675310', To: '+18005551212' })
  const url = 'https://example.com/myapp.php?foo=1&bar=2'
  const signature = 'L/OH5YylLD5NRKLltdqwSvS0BnU='
  expect(verifyTwilioSignature({ url, fields, signature, authToken: '12345' })).toBe(true)
  expect(verifyTwilioSignature({ url: `${url}&extra=1`, fields, signature, authToken: '12345' })).toBe(false)
  fields.set('ExtraProviderField', 'changed')
  expect(verifyTwilioSignature({ url, fields, signature, authToken: '12345' })).toBe(false)
  expect(verifyTwilioSignature({ url, fields, signature: '', authToken: '' })).toBe(false)
})

test('authenticates call callbacks before parsing and rejects another provider account', () => {
  const accountSid = `AC${'a'.repeat(32)}`
  const fields = new URLSearchParams({ AccountSid: accountSid, CallSid: `CA${'b'.repeat(32)}`, From: '+14155550100', To: '+16135550100', CallStatus: 'ringing', Direction: 'inbound', SequenceNumber: '0' })
  const url = 'https://app.example/voice'
  const payload = [...fields.keys()].sort().reduce((value, key) => value + key + fields.get(key), url)
  const signature = createHmac('sha1', 'test-only').update(payload).digest('base64')
  expect(parseVoiceWebhook({ url, fields, signature, authToken: 'test-only', accountSid }).status).toBe('ringing')
  expect(() => parseVoiceWebhook({ url, fields, signature, authToken: 'test-only', accountSid: `AC${'c'.repeat(32)}` })).toThrow()
  fields.append('CallSid', `CA${'d'.repeat(32)}`)
  expect(() => parseVoiceWebhook({ url, fields, signature, authToken: 'test-only', accountSid })).toThrow()
})

test('builds escaped TwiML and rejects invalid stream destinations and XML characters', () => {
  expect(voiceResponse([{ type: 'say', text: 'Hello <Alice> & "Bob"' }, { type: 'hangup' }])).toBe('<?xml version="1.0" encoding="UTF-8"?><Response><Say>Hello &lt;Alice&gt; &amp; &quot;Bob&quot;</Say><Hangup/></Response>')
  expect(voiceResponse([{ type: 'stream', url: 'wss://voice.example/media', parameters: { tenant: 'a"&b' } }])).toContain('<Connect><Stream url="wss://voice.example/media"><Parameter name="tenant" value="a&quot;&amp;b"/></Stream></Connect>')
  expect(() => voiceResponse([{ type: 'stream', url: 'wss://voice.example/media?tenant=a' }])).toThrow()
  expect(() => voiceResponse([{ type: 'say', text: '\0' }])).toThrow()
  expect(() => voiceResponse([{ type: 'say', text: 'a'.repeat(4001) }])).toThrow()
})
