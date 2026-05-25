import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createHmac, generateKeyPairSync, createSign } from 'node:crypto'
import { Buffer } from 'node:buffer'
import {
  verifyMailgunSignature,
  verifyPostmarkAuth,
  verifySendgridSignature,
} from '../src/webhook-signatures'

// stacksjs/stacks#1881 — per-provider webhook signature verification.

describe('verifyMailgunSignature', () => {
  const signingKey = 'mailgun-test-signing-key'

  function sign(timestamp: string, token: string): string {
    return createHmac('sha256', signingKey).update(`${timestamp}${token}`).digest('hex')
  }

  test('accepts a fresh, correctly-signed request', () => {
    const ts = String(Math.floor(Date.now() / 1000))
    const tk = 'abc-def-123'
    const sig = sign(ts, tk)
    const result = verifyMailgunSignature({ timestamp: ts, token: tk, signature: sig, signingKey })
    expect(result.ok).toBe(true)
  })

  test('rejects a bit-flipped signature', () => {
    const ts = String(Math.floor(Date.now() / 1000))
    const tk = 'abc-def-123'
    const sig = sign(ts, tk)
    const tampered = sig.slice(0, -1) + (sig.endsWith('a') ? 'b' : 'a')
    const result = verifyMailgunSignature({ timestamp: ts, token: tk, signature: tampered, signingKey })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('bad-signature')
  })

  test('rejects an expired timestamp (replay-window)', () => {
    const ts = String(Math.floor(Date.now() / 1000) - 600) // 10 minutes ago
    const tk = 'abc-def-123'
    const sig = sign(ts, tk)
    const result = verifyMailgunSignature({
      timestamp: ts, token: tk, signature: sig, signingKey, toleranceSeconds: 300,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('expired')
  })

  test('rejects when the signing key is empty', () => {
    const ts = String(Math.floor(Date.now() / 1000))
    const result = verifyMailgunSignature({ timestamp: ts, token: 't', signature: 's', signingKey: '' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('missing-config')
  })

  test('rejects when fields are missing', () => {
    const result = verifyMailgunSignature({ timestamp: '', token: '', signature: '', signingKey })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('missing-signature')
  })
})

describe('verifyPostmarkAuth', () => {
  const auth = `Basic ${Buffer.from('user:pass').toString('base64')}`

  test('accepts matching basic auth', () => {
    const result = verifyPostmarkAuth({
      authorizationHeader: auth,
      expectedUsername: 'user',
      expectedPassword: 'pass',
    })
    expect(result.ok).toBe(true)
  })

  test('rejects wrong password', () => {
    const result = verifyPostmarkAuth({
      authorizationHeader: auth,
      expectedUsername: 'user',
      expectedPassword: 'wrong',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('bad-signature')
  })

  test('rejects wrong username', () => {
    const result = verifyPostmarkAuth({
      authorizationHeader: auth,
      expectedUsername: 'someone-else',
      expectedPassword: 'pass',
    })
    expect(result.ok).toBe(false)
  })

  test('rejects missing Authorization header', () => {
    const result = verifyPostmarkAuth({
      authorizationHeader: null,
      expectedUsername: 'user',
      expectedPassword: 'pass',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('missing-signature')
  })

  test('rejects non-Basic authorization', () => {
    const result = verifyPostmarkAuth({
      authorizationHeader: 'Bearer some-token',
      expectedUsername: 'user',
      expectedPassword: 'pass',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('missing-signature')
  })

  test('IP allowlist blocks an unrecognized source', () => {
    const result = verifyPostmarkAuth({
      authorizationHeader: auth,
      expectedUsername: 'user',
      expectedPassword: 'pass',
      sourceIp: '8.8.8.8',
      ipAllowlist: ['1.1.1.1', '2.2.2.2'],
    })
    expect(result.ok).toBe(false)
  })

  test('IP allowlist allows a listed source', () => {
    const result = verifyPostmarkAuth({
      authorizationHeader: auth,
      expectedUsername: 'user',
      expectedPassword: 'pass',
      sourceIp: '1.1.1.1',
      ipAllowlist: ['1.1.1.1', '2.2.2.2'],
    })
    expect(result.ok).toBe(true)
  })

  test('rejects when expected credentials are not configured', () => {
    const result = verifyPostmarkAuth({
      authorizationHeader: auth,
      expectedUsername: '',
      expectedPassword: '',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('missing-config')
  })
})

describe('verifySendgridSignature', () => {
  // Generate an ECDSA P-256 keypair for testing
  let publicKeyPem: string
  let privateKey: ReturnType<typeof generateKeyPairSync>['privateKey']

  beforeAll(() => {
    const kp = generateKeyPairSync('ec', { namedCurve: 'P-256' })
    privateKey = kp.privateKey
    publicKeyPem = kp.publicKey.export({ type: 'spki', format: 'pem' }).toString()
  })

  afterAll(() => { /* nothing to clean up */ })

  function sgnSign(body: string, timestamp: string): string {
    const signer = createSign('SHA256')
    signer.update(`${timestamp}${body}`)
    return signer.sign(privateKey).toString('base64')
  }

  test('accepts a valid signature with current timestamp', () => {
    const body = '[{"email":"a@b.com","event":"bounce"}]'
    const ts = String(Math.floor(Date.now() / 1000))
    const sig = sgnSign(body, ts)
    const result = verifySendgridSignature({ body, signature: sig, timestamp: ts, publicKeyPem })
    expect(result.ok).toBe(true)
  })

  test('rejects a body that has been tampered', () => {
    const body = '[{"email":"a@b.com","event":"bounce"}]'
    const ts = String(Math.floor(Date.now() / 1000))
    const sig = sgnSign(body, ts)
    const result = verifySendgridSignature({
      body: '[{"email":"a@b.com","event":"DELIVERED"}]', // tampered
      signature: sig,
      timestamp: ts,
      publicKeyPem,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('bad-signature')
  })

  test('rejects an expired timestamp', () => {
    const body = '[]'
    const ts = String(Math.floor(Date.now() / 1000) - 9999)
    const sig = sgnSign(body, ts)
    const result = verifySendgridSignature({ body, signature: sig, timestamp: ts, publicKeyPem })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('expired')
  })

  test('rejects missing public key', () => {
    const result = verifySendgridSignature({ body: 'x', signature: 's', timestamp: '1', publicKeyPem: '' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('missing-config')
  })
})
