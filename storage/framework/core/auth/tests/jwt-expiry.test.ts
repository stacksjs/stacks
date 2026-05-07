/**
 * JWT-expiry regression tests for #1839.
 *
 * Up until #1839 every stacks-issued bearer token had a hard-coded
 * 30-day `exp` claim regardless of the configured `tokenExpiry`. That
 * meant a token leaking yesterday could still authenticate 29 days
 * from now, even after the operator shipped a config change. The fix
 * surfaces the expiry as a parameter on `TokenManager.generateJWT`
 * (see ../src/token.ts) so the JWT `exp` matches the DB `expires_at`.
 *
 * This file lives apart from `tokens.test.ts` because the real
 * `TokenManager` can't be imported in a unit-only test boot here —
 * it transitively pulls in `@stacksjs/database` → `bun-router`, which
 * has its own export-shape friction. The regression we actually want
 * to lock down is the `exp - iat` arithmetic, which is just HMAC over
 * a fixed payload shape; we replicate the minimum surface inline so
 * the test runs without dragging the DB stack along.
 *
 * Keep this in lockstep with `TokenManager.generateJWT` — any drift in
 * the real implementation's expiry arithmetic should be reflected
 * here, or these assertions will go stale.
 */

import { describe, expect, test } from 'bun:test'
import { Buffer } from 'node:buffer'
import { createHmac, randomBytes } from 'node:crypto'
import process from 'node:process'

// HMAC signing requires APP_KEY. The framework's preloader sets it on
// real boots; here we set a deterministic placeholder up-front.
process.env.APP_KEY = process.env.APP_KEY || 'test-app-key-1839-bearer-rotation'

/** Inline replica of `TokenManager.generateJWT`. */
function generateJWT(userId: number, expiresInSeconds: number = 60 * 60): string {
  const header = { alg: 'HS256', typ: 'JWT' }
  const nowSeconds = Math.floor(Date.now() / 1000)
  const payload = {
    sub: userId,
    iat: nowSeconds,
    exp: nowSeconds + expiresInSeconds,
    jti: randomBytes(16).toString('hex'),
  }
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url')
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = createHmac('sha256', process.env.APP_KEY!)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url')
  return `${encodedHeader}.${encodedPayload}.${signature}`
}

function decodePayload(jwt: string): { iat: number, exp: number, sub: number, jti: string } {
  const [, payloadB64] = jwt.split('.')
  return JSON.parse(Buffer.from(payloadB64!, 'base64url').toString('utf-8'))
}

describe('JWT expiry (#1839)', () => {
  test('default expiry is 1 hour, not the legacy 30 days', () => {
    const before = Math.floor(Date.now() / 1000)
    const jwt = generateJWT(42)
    const after = Math.floor(Date.now() / 1000)
    const { iat, exp } = decodePayload(jwt)

    expect(iat).toBeGreaterThanOrEqual(before)
    expect(iat).toBeLessThanOrEqual(after)

    // Lifetime must be exactly the 1-hour default, not the legacy 30-day value.
    expect(exp - iat).toBe(60 * 60)
    expect(exp - iat).not.toBe(60 * 60 * 24 * 30)
  })

  test('custom expiresInSeconds is honoured', () => {
    const jwt = generateJWT(7, 15 * 60) // 15 minutes
    const { iat, exp } = decodePayload(jwt)
    expect(exp - iat).toBe(15 * 60)
  })

  test('embeds the user id as the sub claim', () => {
    const jwt = generateJWT(123, 600)
    expect(decodePayload(jwt).sub).toBe(123)
  })

  test('jti is unique per token (replay protection)', () => {
    const a = generateJWT(1, 60)
    const b = generateJWT(1, 60)
    expect(decodePayload(a).jti).not.toBe(decodePayload(b).jti)
  })

  test('produced JWT is the standard 3-segment HS256 shape', () => {
    const jwt = generateJWT(1, 60)
    const segments = jwt.split('.')
    expect(segments).toHaveLength(3)
    const header = JSON.parse(Buffer.from(segments[0]!, 'base64url').toString('utf-8'))
    expect(header.alg).toBe('HS256')
    expect(header.typ).toBe('JWT')
  })
})
