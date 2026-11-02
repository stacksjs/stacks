import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import { configureFCM, send } from '../src/index'
import { resetConfiguration } from '../src/drivers/fcm'

/**
 * stacksjs/stacks#3098, through the generic `send()` an app calls. FCM v1
 * `data` is a map of strings and FCM answers 400 for any other value; the
 * same call carries any JSON on Expo and APNs. An unset priority was `high`
 * on Android and APNs priority 5 on iOS. And a multicast gave back only a
 * count, with no way to tell which token is dead.
 */
const realFetch = globalThis.fetch
let sent: Array<{ token: string, message: any }> = []
let deadToken: string | undefined
let privateKey = ''

beforeAll(async () => {
  const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']) as CryptoKeyPair
  const pkcs8 = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey))))
  privateKey = `-----BEGIN PRIVATE KEY-----\n${pkcs8}\n-----END PRIVATE KEY-----\n`
})

beforeEach(() => {
  sent = []
  deadToken = undefined
  configureFCM({ projectId: 'stacks-test', serviceAccount: { clientEmail: 'push@stacks-test.iam.gserviceaccount.com', privateKey } })
  globalThis.fetch = (async (input: any, init: any = {}) => {
    const url = String(input)
    if (url.startsWith('https://oauth2.googleapis.com/token'))
      return new Response(JSON.stringify({ access_token: 'test-access-token', expires_in: 3600 }))
    const body = JSON.parse(init.body)
    sent.push({ token: body.message.token, message: body.message })
    if (body.message.token === deadToken)
      return new Response(JSON.stringify({ error: { status: 'NOT_FOUND', details: [{ errorCode: 'UNREGISTERED' }] } }), { status: 404 })
    return new Response(JSON.stringify({ name: `projects/stacks-test/messages/${body.message.token}` }))
  }) as typeof fetch
})

afterEach(() => {
  globalThis.fetch = realFetch
  resetConfiguration()
})

describe('push.send() through FCM', () => {
  it('sends every data value as a string, as FCM requires', async () => {
    await send('device-a', { title: 'Order shipped', body: 'On its way', data: { orderId: 42, items: ['a', 'b'], urgent: true, note: 'leave at door', missing: undefined } }, { driver: 'fcm' })

    expect(sent[0]?.message.data).toEqual({ orderId: '42', items: '["a","b"]', urgent: 'true', note: 'leave at door' })
  })

  it('gives iOS the same priority as Android', async () => {
    await send('device-a', { body: 'Unset' }, { driver: 'fcm' })
    await send('device-a', { body: 'Normal', priority: 'normal' }, { driver: 'fcm' })
    await send('device-a', { body: 'Default', priority: 'default' }, { driver: 'fcm' })

    expect(sent.map(s => [s.message.android.priority, s.message.apns.headers['apns-priority']])).toEqual([
      ['high', '10'],
      ['normal', '5'],
      ['normal', '5'],
    ])
  })

  it('returns one result per device from a multicast, so a dead token can be told apart', async () => {
    deadToken = 'device-b'
    const result = await send(['device-a', 'device-b', 'device-c'], { body: 'Hello' }, { driver: 'fcm' })

    expect(result.success).toBe(false)
    expect(result.message).toBe('Sent to 2/3 devices')
    const results = (result.data as { results: Array<{ success: boolean, message: string }> }).results
    expect(results.map(r => r.success)).toEqual([true, false, true])
    expect(results[1]?.message).toContain('UNREGISTERED')
  })
})
