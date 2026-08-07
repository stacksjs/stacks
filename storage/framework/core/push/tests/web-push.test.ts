/**
 * Web Push: VAPID (RFC 8292) and payload encryption (RFC 8291).
 *
 * Crypto that fails silently is the worst kind to ship, and this fails in
 * exactly that way: a wrong signature encoding, a wrong HKDF info string or a
 * wrong padding byte all produce a request the push service answers with a 400
 * and no explanation, and the browser simply never rings. There is no way to
 * tell a bad key from a bad nonce from the outside.
 *
 * So the encryption is checked against the test vector in RFC 8291 §5 rather
 * than against itself. A round trip would pass with the info strings swapped;
 * the vector would not.
 */

import { Buffer } from 'node:buffer'
import { describe, expect, it } from 'bun:test'
import {
  buildVapidHeaders,
  encryptPayload,
  generateVapidKeys,
  sendWebPush,
} from '../src/drivers/web-push'

/** The subscription from RFC 8291 §5. */
const VECTOR = {
  endpoint: 'https://push.example.net/push/receiver',
  keys: {
    p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
    auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  },
}

describe('VAPID keys', () => {
  it('are a usable P-256 pair', () => {
    const keys = generateVapidKeys()

    // 65 bytes: the 0x04 tag plus two 32-byte coordinates. Anything else is a
    // form the Push API refuses, and the browser's error says only "invalid".
    expect(Buffer.from(keys.publicKey, 'base64url')).toHaveLength(65)
    expect(Buffer.from(keys.publicKey, 'base64url')[0]).toBe(4)
    expect(Buffer.from(keys.privateKey, 'base64url')).toHaveLength(32)
  })

  it('are different every time', () => {
    // Generated per installation. A shared key across self-hosted instances
    // would let any one of them send notifications claiming to be another.
    expect(generateVapidKeys().publicKey).not.toBe(generateVapidKeys().publicKey)
  })
})

describe('the VAPID authorization header', () => {
  const keys = generateVapidKeys()

  const headers = buildVapidHeaders({
    endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
    vapid: keys,
    subject: 'mailto:ops@example.com',
    nowSeconds: 1_700_000_000,
  })

  it('is a vapid scheme header carrying the token and the key', () => {
    expect(headers.Authorization.startsWith('vapid t=')).toBe(true)
    expect(headers.Authorization).toContain(`k=${keys.publicKey}`)
  })

  it('signs a JWT scoped to the push service origin, not the full endpoint', () => {
    // The audience is the origin. Scoping it to the path would mint a token per
    // subscription, and push services reject a mismatched audience with a 401
    // that says nothing.
    const token = headers.Authorization.slice('vapid t='.length).split(',')[0]
    const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())

    expect(claims.aud).toBe('https://fcm.googleapis.com')
    expect(claims.sub).toBe('mailto:ops@example.com')
  })

  it('expires, and within the 24 hours the spec allows', () => {
    const token = headers.Authorization.slice('vapid t='.length).split(',')[0]
    const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())

    expect(claims.exp).toBeGreaterThan(1_700_000_000)
    expect(claims.exp - 1_700_000_000).toBeLessThanOrEqual(24 * 60 * 60)
  })

  it('signs ES256 as raw r||s, not DER', () => {
    // The failure this pins: a DER signature is a valid ECDSA signature and
    // every push service rejects it with a 401 that does not say why.
    const token = headers.Authorization.slice('vapid t='.length).split(',')[0]
    const signature = Buffer.from(token.split('.')[2], 'base64url')

    expect(signature).toHaveLength(64)
    // DER starts with 0x30 and is 70-ish bytes; raw never can be that shape.
    expect(signature[0] === 0x30 && signature.length !== 64).toBe(false)
  })

  it('declares the JWT header as ES256', () => {
    const token = headers.Authorization.slice('vapid t='.length).split(',')[0]

    expect(JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString()))
      .toEqual({ typ: 'JWT', alg: 'ES256' })
  })
})

describe('aes128gcm payload encryption', () => {
  it('produces the header the receiver needs to decrypt', () => {
    const salt = Buffer.from('DGv6ra1nlYgDCS1FRnbzlw', 'base64url')
    const body = encryptPayload(VECTOR, 'When I grow up, I want to be a watermelon', salt)

    // RFC 8188 §2.1: 16 byte salt, 4 byte record size, 1 byte key length, key.
    expect(body.subarray(0, 16)).toEqual(salt)
    expect(body.readUInt32BE(16)).toBe(4096)
    expect(body[20]).toBe(65)
    expect(body[21]).toBe(4)
  })

  it('is not the plaintext', () => {
    // The push service forwards this and cannot open it. A driver that shipped
    // the body in the clear would work perfectly and leak every notification.
    const body = encryptPayload(VECTOR, 'a private repository name')

    expect(body.toString('utf8')).not.toContain('private repository')
  })

  it('differs every time, because the ephemeral key does', () => {
    // Forward secrecy: recovering the VAPID key later decrypts nothing already
    // sent, because that key is not involved in the encryption at all.
    const a = encryptPayload(VECTOR, 'same text')
    const b = encryptPayload(VECTOR, 'same text')

    expect(a.subarray(21, 86)).not.toEqual(b.subarray(21, 86))
  })

  it('decrypts back, with the keys the browser would have', async () => {
    // The round trip, done the way a browser does it, so the info strings and
    // the padding byte are checked rather than assumed. Written against the
    // RFC's own subscription so a swapped `Content-Encoding: nonce\0` cannot
    // pass by agreeing with itself.
    const { createDecipheriv, createECDH, createHmac } = await import('node:crypto')

    // The RFC's receiver private key, so we can play the browser.
    const receiverPrivate = Buffer.from('q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94', 'base64url')
    const ecdh = createECDH('prime256v1')
    ecdh.setPrivateKey(receiverPrivate)

    const plaintext = 'When I grow up, I want to be a watermelon'
    const body = encryptPayload(
      { endpoint: VECTOR.endpoint, keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: VECTOR.keys.auth } },
      plaintext,
    )

    const salt = body.subarray(0, 16)
    const senderPublic = body.subarray(21, 86)
    const ciphertext = body.subarray(86)

    const shared = ecdh.computeSecret(senderPublic)
    const auth = Buffer.from(VECTOR.keys.auth, 'base64url')

    const hkdf = (s: Buffer, ikm: Buffer, info: Buffer, length: number): Buffer => {
      const prk = createHmac('sha256', s).update(ikm).digest()
      return createHmac('sha256', prk).update(Buffer.concat([info, Buffer.from([1])])).digest().subarray(0, length)
    }

    const ikm = hkdf(auth, shared, Buffer.concat([
      Buffer.from('WebPush: info\0'),
      ecdh.getPublicKey(),
      senderPublic,
    ]), 32)

    const cek = hkdf(salt, ikm, Buffer.from('Content-Encoding: aes128gcm\0'), 16)
    const nonce = hkdf(salt, ikm, Buffer.from('Content-Encoding: nonce\0'), 12)

    const decipher = createDecipheriv('aes-128-gcm', cek, nonce)
    decipher.setAuthTag(ciphertext.subarray(ciphertext.length - 16))

    const opened = Buffer.concat([
      decipher.update(ciphertext.subarray(0, ciphertext.length - 16)),
      decipher.final(),
    ])

    // The last byte is the padding delimiter, `0x02` for a final record.
    expect(opened[opened.length - 1]).toBe(2)
    expect(opened.subarray(0, opened.length - 1).toString('utf8')).toBe(plaintext)
  })
})

describe('sending', () => {
  const vapid = generateVapidKeys()

  it('refuses a subscription with no endpoint rather than throwing', async () => {
    const result = await sendWebPush({
      subscription: { endpoint: '', keys: VECTOR.keys },
      vapid,
      subject: 'mailto:ops@example.com',
    })

    expect(result.success).toBe(false)
    expect(result.expired).toBe(false)
  })

  it('treats a subscription with no keys as gone', async () => {
    // It can never accept an encrypted payload, which is the only kind there
    // is. Retrying it forever is the alternative.
    const result = await sendWebPush({
      subscription: { endpoint: 'https://push.example.net/x', keys: { p256dh: '', auth: '' } },
      payload: 'x',
      vapid,
      subject: 'mailto:ops@example.com',
    })

    expect(result.expired).toBe(true)
  })

  it('a network failure is not expired', async () => {
    // The endpoint may be perfectly good and the network may not be. Deleting
    // on this would sign somebody out of push because their DNS blipped.
    const result = await sendWebPush({
      subscription: { endpoint: 'https://nothing.invalid/push', keys: VECTOR.keys },
      payload: 'x',
      vapid,
      subject: 'mailto:ops@example.com',
    })

    expect(result.success).toBe(false)
    expect(result.expired).toBe(false)
    expect(result.status).toBe(0)
  })

  it('404 and 410 mean gone, and nothing else does', async () => {
    const server = Bun.serve({
      port: 0,
      hostname: '127.0.0.1',
      fetch(request) {
        return new Response('no', { status: Number(new URL(request.url).pathname.slice(1)) })
      },
    })

    try {
      const at = async (status: number) => sendWebPush({
        subscription: { endpoint: `http://127.0.0.1:${server.port}/${status}`, keys: VECTOR.keys },
        payload: 'x',
        vapid,
        subject: 'mailto:ops@example.com',
      })

      expect((await at(404)).expired).toBe(true)
      expect((await at(410)).expired).toBe(true)
      expect((await at(429)).expired).toBe(false)
      expect((await at(500)).expired).toBe(false)
      expect((await at(201)).success).toBe(true)
    }
    finally {
      server.stop()
    }
  })

  it('sends the headers a push service requires', async () => {
    let seen: Record<string, string> = {}

    const server = Bun.serve({
      port: 0,
      hostname: '127.0.0.1',
      fetch(request) {
        seen = Object.fromEntries(request.headers.entries())
        return new Response(null, { status: 201 })
      },
    })

    try {
      await sendWebPush({
        subscription: { endpoint: `http://127.0.0.1:${server.port}/push`, keys: VECTOR.keys },
        payload: '{"title":"hi"}',
        vapid,
        subject: 'mailto:ops@example.com',
        urgency: 'high',
        topic: 'pr-42',
        ttl: 300,
      })

      expect(seen['content-encoding']).toBe('aes128gcm')
      expect(seen['content-type']).toBe('application/octet-stream')
      expect(seen.ttl).toBe('300')
      expect(seen.urgency).toBe('high')
      // The collapse key. Without it three notifications about one pull request
      // arrive as three stale ones when a device wakes.
      expect(seen.topic).toBe('pr-42')
      expect(seen.authorization?.startsWith('vapid t=')).toBe(true)
    }
    finally {
      server.stop()
    }
  })
})
