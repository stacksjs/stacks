/**
 * Web Push: VAPID (RFC 8292) and payload encryption (RFC 8291).
 *
 * The third push driver, and the odd one out. Expo and FCM are HTTP APIs with a
 * bearer token; Web Push is a protocol, and the browser vendors deliberately
 * built it so the push service - Google's, Mozilla's, Apple's - **cannot read
 * the payload**. That means the encryption is not an optional hardening step
 * somebody can skip: an unencrypted body is simply rejected, and there is no
 * SDK to hide it behind because the endpoint is whatever the browser handed you.
 *
 * Two independent pieces, and conflating them is the usual way this goes wrong:
 *
 * **VAPID identifies the sender.** A signed JWT in an `Authorization` header
 * that says "this application server sent this", so a push service can rate
 * limit and contact you rather than treating every request as anonymous. It
 * says nothing about the content.
 *
 * **RFC 8291 hides the content.** ECDH against the key the browser generated,
 * HKDF to derive a content key and nonce, AES-128-GCM. The push service
 * forwards ciphertext it cannot open. The subscription's `p256dh` is the
 * browser's public key and `auth` is a shared secret that goes into the key
 * derivation - which is why a subscription is useless without both.
 *
 * Built on `node:crypto` alone. A dependency here would be a dependency in
 * every application that sends one notification, for a protocol that is a few
 * hundred lines of well-specified crypto.
 */

import { Buffer } from 'node:buffer'
import {
  createCipheriv,
  createECDH,
  createHmac,
  createPrivateKey,
  createSign,
  generateKeyPairSync,
  randomBytes,
} from 'node:crypto'

/** A browser's subscription, exactly as `PushSubscription.toJSON()` gives it. */
export interface WebPushSubscription {
  endpoint: string
  keys: {
    /** The browser's public key, base64url, uncompressed P-256 point. */
    p256dh: string
    /** A shared secret the browser generated, base64url, 16 bytes. */
    auth: string
  }
}

export interface VapidKeys {
  /** base64url, uncompressed P-256 point. Safe to ship to the browser. */
  publicKey: string
  /** base64url, the raw 32-byte scalar. Never leaves the server. */
  privateKey: string
}

export interface WebPushResult {
  success: boolean
  status: number
  /**
   * True when the push service says this endpoint is gone for good.
   *
   * `404` and `410` are the only two answers that mean "delete this row". Every
   * other failure is worth retrying, and deleting on one of those would sign
   * somebody out of push because their network blipped.
   */
  expired: boolean
  error?: string
}

export interface SendWebPushOptions {
  subscription: WebPushSubscription
  /** Any bytes. JSON is conventional; the protocol does not care. */
  payload?: string
  vapid: VapidKeys
  /**
   * `mailto:` or `https:`, identifying whoever runs this server.
   *
   * Required by RFC 8292 and not decorative: it is how a push service reaches
   * somebody when a deployment starts misbehaving, and the alternative to
   * reaching them is being blocked.
   */
  subject: string
  /** Seconds the push service should hold it for an offline browser. */
  ttl?: number
  /**
   * `high` maps to `urgency: high`, which is what wakes a device that is
   * conserving battery. Anything a person is *blocked on* deserves it; a digest
   * does not, and spending it on one is how a device stops honouring it.
   */
  urgency?: 'very-low' | 'low' | 'normal' | 'high'
  /**
   * Collapse key. A push service keeps only the newest message with a given
   * topic for an offline browser, so three notifications about one pull request
   * become one rather than three stale ones on wake.
   *
   * Must be base64url and at most 32 characters, which the spec requires and
   * every push service enforces by rejecting the request.
   */
  topic?: string
}

const P256 = 'prime256v1'

function b64url(buffer: Buffer): string {
  return buffer.toString('base64url')
}

function fromB64url(value: string): Buffer {
  return Buffer.from(value, 'base64url')
}

/**
 * A fresh VAPID keypair.
 *
 * Generated per installation rather than shipped. A shared key across every
 * self-hosted instance would let any one of them send push notifications
 * claiming to be any other, and would make a single revocation break everybody.
 */
export function generateVapidKeys(): VapidKeys {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: P256 })

  const publicRaw = publicKey.export({ type: 'spki', format: 'der' })
  const privateJwk: any = privateKey.export({ format: 'jwk' })

  return {
    // The last 65 bytes of the SPKI encoding are the uncompressed point, which
    // is the form the Push API expects and the only form a browser accepts.
    publicKey: b64url(publicRaw.subarray(publicRaw.length - 65)),
    privateKey: String(privateJwk.d),
  }
}

/** The origin a push endpoint belongs to, which is what the JWT is scoped to. */
function audienceOf(endpoint: string): string {
  const url = new URL(endpoint)

  return `${url.protocol}//${url.host}`
}

/**
 * The `Authorization` and `Crypto-Key` headers RFC 8292 asks for.
 *
 * The JWT is scoped to the push service's origin and expires, so a leaked one
 * is useful to one service for a limited time rather than being a permanent
 * credential for everything.
 */
export function buildVapidHeaders(options: {
  endpoint: string
  vapid: VapidKeys
  subject: string
  expiresInSeconds?: number
  /** Passed in so this is testable without pretending it is a particular day. */
  nowSeconds?: number
}): Record<string, string> {
  const now = Math.floor(options.nowSeconds ?? Date.now() / 1000)
  // Twelve hours. The spec caps it at 24 and a shorter life is strictly better;
  // this is long enough that a queue backlog does not invalidate a signed
  // request before it is sent.
  const exp = now + Math.min(options.expiresInSeconds ?? 12 * 60 * 60, 24 * 60 * 60)

  const header = b64url(Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const body = b64url(Buffer.from(JSON.stringify({
    aud: audienceOf(options.endpoint),
    exp,
    sub: options.subject,
  })))

  const signingInput = `${header}.${body}`

  const key = createPrivateKey({
    key: {
      kty: 'EC',
      crv: 'P-256',
      d: options.vapid.privateKey,
      // The public half, split back into its coordinates. A JWK private key
      // needs them, and deriving them here means callers store one string.
      x: b64url(fromB64url(options.vapid.publicKey).subarray(1, 33)),
      y: b64url(fromB64url(options.vapid.publicKey).subarray(33, 65)),
    } as any,
    format: 'jwk',
  })

  const signer = createSign('SHA256')
  signer.update(signingInput)

  // `ieee-p1363` rather than the default DER. ES256 is the raw r||s pair, and a
  // DER signature is silently rejected by every push service with a 401 that
  // says nothing about why.
  const signature = signer.sign({ key, dsaEncoding: 'ieee-p1363' })

  return {
    'Authorization': `vapid t=${signingInput}.${b64url(signature)}, k=${options.vapid.publicKey}`,
    // Sent as well, for push services still on the older draft. Harmless to the
    // ones that are not, and the alternative is silently failing on Firefox
    // deployments that have not caught up.
    'Crypto-Key': `p256ecdsa=${options.vapid.publicKey}`,
  }
}

/** HKDF, as RFC 5869 spells it. Node's own is fine but not available everywhere Bun runs. */
function hkdf(salt: Buffer, ikm: Buffer, info: Buffer, length: number): Buffer {
  const prk = createHmac('sha256', salt).update(ikm).digest()
  const output = createHmac('sha256', prk).update(Buffer.concat([info, Buffer.from([1])])).digest()

  return output.subarray(0, length)
}

/**
 * Encrypt a payload for one subscription, in the `aes128gcm` content encoding.
 *
 * The wire format is a header the receiver needs to decrypt - salt, record
 * size, and our ephemeral public key - followed by the ciphertext. The browser
 * has everything else already.
 *
 * A fresh ephemeral keypair per message, which is what makes this forward
 * secret: recovering the server's VAPID key later does not decrypt anything
 * already sent, because that key is not involved in the encryption at all.
 */
export function encryptPayload(
  subscription: WebPushSubscription,
  payload: string,
  salt: Buffer = randomBytes(16),
): Buffer {
  const clientPublic = fromB64url(subscription.keys.p256dh)
  const auth = fromB64url(subscription.keys.auth)

  const ecdh = createECDH(P256)
  ecdh.generateKeys()

  const serverPublic = ecdh.getPublicKey()
  const shared = ecdh.computeSecret(clientPublic)

  // RFC 8291 §3.3: the shared secret is stretched with the browser's auth
  // secret before anything else, so a push service that somehow saw the ECDH
  // exchange still cannot derive the content key.
  const prkInfo = Buffer.concat([
    Buffer.from('WebPush: info\0'),
    clientPublic,
    serverPublic,
  ])

  const ikm = hkdf(auth, shared, prkInfo, 32)
  const cek = hkdf(salt, ikm, Buffer.from('Content-Encoding: aes128gcm\0'), 16)
  const nonce = hkdf(salt, ikm, Buffer.from('Content-Encoding: nonce\0'), 12)

  const cipher = createCipheriv('aes-128-gcm', cek, nonce)

  // The padding delimiter. `0x02` marks the last record, and there is always
  // exactly one record here: chunking buys nothing for a payload measured in
  // hundreds of bytes and every push service caps the whole body at 4KB anyway.
  const body = Buffer.concat([Buffer.from(payload, 'utf8'), Buffer.from([2])])
  const ciphertext = Buffer.concat([cipher.update(body), cipher.final(), cipher.getAuthTag()])

  const recordSize = Buffer.alloc(4)
  recordSize.writeUInt32BE(4096, 0)

  return Buffer.concat([
    salt,
    recordSize,
    Buffer.from([serverPublic.length]),
    serverPublic,
    ciphertext,
  ])
}

/**
 * Send one notification to one browser.
 *
 * Returns rather than throws, and says whether the endpoint is *gone*. That
 * distinction is the whole reason this returns a shape rather than a boolean:
 * a caller that cannot tell "try again later" from "this browser is never
 * coming back" either retries forever against a dead endpoint or deletes
 * somebody's subscription because their network blipped.
 */
export async function sendWebPush(options: SendWebPushOptions): Promise<WebPushResult> {
  const { subscription, vapid, subject } = options

  if (!subscription?.endpoint)
    return { success: false, status: 0, expired: false, error: 'no endpoint' }

  const headers: Record<string, string> = {
    ...buildVapidHeaders({ endpoint: subscription.endpoint, vapid, subject }),
    'TTL': String(options.ttl ?? 60 * 60 * 24),
    'Urgency': options.urgency ?? 'normal',
  }

  if (options.topic)
    headers.Topic = options.topic

  let body: Buffer | undefined

  if (options.payload) {
    if (!subscription.keys?.p256dh || !subscription.keys?.auth)
      return { success: false, status: 0, expired: true, error: 'subscription has no keys' }

    body = encryptPayload(subscription, options.payload)
    headers['Content-Encoding'] = 'aes128gcm'
    headers['Content-Type'] = 'application/octet-stream'
    headers['Content-Length'] = String(body.length)
  }

  try {
    const answer = await fetch(subscription.endpoint, {
      method: 'POST',
      headers,
      body: body as any,
    })

    // 404 and 410 are the only two that mean the subscription is gone. Every
    // other failure is transient by definition - a 429 is "slow down", a 5xx is
    // theirs - and treating one as permanent loses somebody their push.
    const expired = answer.status === 404 || answer.status === 410

    if (answer.status >= 200 && answer.status < 300)
      return { success: true, status: answer.status, expired: false }

    return {
      success: false,
      status: answer.status,
      expired,
      error: (await answer.text().catch(() => '')).slice(0, 500) || `push service answered ${answer.status}`,
    }
  }
  catch (error) {
    // Never reached a server. Not expired: the endpoint may be perfectly good
    // and the network may not be.
    return {
      success: false,
      status: 0,
      expired: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
