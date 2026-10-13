import { describe, expect, test } from 'bun:test'
import { generateWebhookSecret, InvalidWebhookSignature, signWebhook, verifySignedWebhook, verifyStripe, verifyWebhook } from '../src/webhook'

const secret = 'whsec_test_secret'
const body = JSON.stringify({ id: 'evt_1', type: 'booking.created', data: { id: 7 } })
const now = 1_760_000_000

function reason(fn: () => unknown): string | undefined {
  try {
    fn()
  }
  catch (error) {
    if (error instanceof InvalidWebhookSignature)
      return error.reason
    throw error
  }
  return undefined
}

describe('signWebhook', () => {
  test('signs `${t}.${body}` with HMAC-SHA256 and writes t=,v1= header', async () => {
    const signed = signWebhook(secret, body, { timestamp: now })
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const digest = Buffer.from(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${now}.${body}`))).toString('hex')
    expect(signed.timestamp).toBe(now)
    expect(signed.signatures).toEqual([digest])
    expect(signed.header).toBe(`t=${now},v1=${digest}`)
  })

  test('round-trips through verifySignedWebhook, verifyWebhook(signed) and verifyStripe', () => {
    const { header } = signWebhook(secret, body, { timestamp: now })
    expect(verifySignedWebhook(secret, header, body, { now: now * 1000 })).toBe(true)
    expect(verifyWebhook('signed', secret, header, Buffer.from(body), { now: now * 1000 })).toBe(true)
    expect(verifyStripe(secret, header, body, { now: now * 1000 })).toBe(true)
  })

  test('signs with every secret while rotating; either one verifies', () => {
    const next = 'whsec_next'
    const { header, signatures } = signWebhook([secret, next], body, { timestamp: now })
    expect(signatures).toHaveLength(2)
    expect(header.split(',').filter(part => part.startsWith('v1='))).toHaveLength(2)
    expect(verifySignedWebhook(secret, header, body, { now: now * 1000 })).toBe(true)
    expect(verifySignedWebhook(next, header, body, { now: now * 1000 })).toBe(true)
    expect(reason(() => verifySignedWebhook('whsec_other', header, body, { now: now * 1000 }))).toBe('mismatch')
  })

  test('a changed body, an old or a future timestamp is refused', () => {
    const { header } = signWebhook(secret, body, { timestamp: now })
    expect(reason(() => verifySignedWebhook(secret, header, `${body} `, { now: now * 1000 }))).toBe('mismatch')
    expect(reason(() => verifySignedWebhook(secret, header, body, { now: (now + 301) * 1000 }))).toBe('expired')
    expect(reason(() => verifySignedWebhook(secret, header, body, { now: (now - 301) * 1000 }))).toBe('expired')
    expect(verifySignedWebhook(secret, header, body, { now: (now + 600) * 1000, toleranceSeconds: 900 })).toBe(true)
  })

  test('refuses an empty secret, a missing or malformed header and a bad timestamp', () => {
    expect(reason(() => signWebhook('', body))).toBe('missing')
    expect(reason(() => signWebhook([], body))).toBe('missing')
    expect(reason(() => signWebhook(secret, body, { timestamp: 1.5 }))).toBe('malformed')
    expect(reason(() => verifySignedWebhook(secret, '', body))).toBe('missing')
    expect(reason(() => verifySignedWebhook(secret, 'v1=abc', body))).toBe('malformed')
  })

  test('defaults the timestamp to now', () => {
    const before = Math.floor(Date.now() / 1000)
    const { timestamp } = signWebhook(secret, body)
    expect(timestamp).toBeGreaterThanOrEqual(before)
    expect(timestamp).toBeLessThanOrEqual(before + 1)
  })
})

describe('generateWebhookSecret', () => {
  test('is prefixed, 32 random bytes of base64url, and unique', () => {
    const first = generateWebhookSecret()
    expect(first).toMatch(/^whsec_[\w-]{43}$/)
    expect(generateWebhookSecret()).not.toBe(first)
    expect(generateWebhookSecret('hqwh_')).toStartWith('hqwh_')
  })
})
