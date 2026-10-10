import assert from 'node:assert/strict'
import { configure as configureSms, init as initSms } from '@stacksjs/sms'
import { configureSlack } from '@stacksjs/chat'
import { config } from '@stacksjs/config'
import { ensureSuccessfulNotificationResults, notify, resolveDeliveryRecipient, useSMS } from '../../src/index'

assert.equal(typeof useSMS().send, 'function', 'the default SMS transport must use the native facade')
await initSms()
configureSms({ provider: 'twilio', drivers: { twilio: { accountSid: 'ACfixture', authToken: 'fixture', from: '+15555550101' } } })
configureSlack({ botToken: 'fixture', maxRetries: 0, retryTimeout: 0 })
;(config as any).notification.tracking = { enabled: false }
let rejected = false
const requests: Array<{ url: string, body: string }> = []
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = String(input)
  requests.push({ url, body: String(init?.body || '') })
  if (url.startsWith('https://api.twilio.com/')) return Response.json(rejected ? { message: 'SMS rejected' } : { sid: 'SMfixture', status: 'queued' }, { status: rejected ? 400 : 201 })
  if (url === 'https://slack.com/api/chat.postMessage') return Response.json(rejected ? { ok: false, error: 'channel_not_found' } : { ok: true, ts: 'fixture' })
  if (url === 'https://exp.host/--/api/v2/push/send') return Response.json({ data: [{ status: rejected ? 'error' : 'ok', ...(rejected ? { message: 'DeviceNotRegistered' } : { id: 'fixture' }) }] })
  throw new Error(`Unexpected provider URL: ${url}`)
}) as typeof fetch

const recipient = { phone: '+15555550100', chatRecipient: 'Cfixture', pushTokens: 'ExponentPushToken[fixture]' }
const payload = { subject: 'Update', body: 'Training starts soon' }
const sent = await notify(recipient, payload, ['sms', 'chat', 'push', 'sms'], { ignorePreferences: true })
assert(sent.every(result => result.success), JSON.stringify(sent))
ensureSuccessfulNotificationResults(sent)
assert.equal(requests.length, 3)
assert.equal(new URLSearchParams(requests.find(request => request.url.includes('twilio'))!.body).get('Body'), payload.body)
const chat = JSON.parse(requests.find(request => request.url.includes('slack'))!.body)
assert.equal(chat.channel, 'Cfixture')
assert.equal(chat.text, payload.body)
rejected = true
const failed = await notify(recipient, payload, ['sms', 'chat', 'push', 'broadcast'], { ignorePreferences: true })
assert(failed.every(result => !result.success), JSON.stringify(failed))
assert.match(failed[0]!.error!.message, /SMS rejected/)
assert.match(failed[1]!.error!.message, /channel_not_found/)
assert.match(failed[2]!.error!.message, /0\/1/)
assert.match(failed[3]!.error!.message, /realtime/)
assert.throws(() => ensureSuccessfulNotificationResults(failed), AggregateError)
assert.throws(() => ensureSuccessfulNotificationResults([]), /No notification channels/)
assert.throws(() => ensureSuccessfulNotificationResults([failed[0]!]), /SMS rejected/)
assert.equal(resolveDeliveryRecipient(recipient, 'chat'), 'Cfixture')
assert.equal(resolveDeliveryRecipient({ chatRecipient: ['C1', 'C2'] }, 'chat'), 'C1, C2')
assert.equal((await useSMS('twilio').send({ to: recipient.phone, body: payload.body })).success, false)
assert.throws(() => useSMS('missing'), /Unsupported SMS driver/)
const noRecipient = await notify({}, payload, ['chat'], { ignorePreferences: true })
assert.equal(noRecipient[0]!.success, false)
assert.match(noRecipient[0]!.error!.message, /chatRecipient/)
process.stdout.write('notification provider outcomes OK\n')
