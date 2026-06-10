/**
 * Two-factor verification hardening (audit follow-up).
 *
 * The bare TOTP primitive only answers "is this code currently valid?". A
 * real 2FA verifier additionally needs:
 *   - replay protection (a valid code must be single-use within its window)
 *   - rate limiting (so a stolen password can't brute-force the 2nd factor)
 *
 * Both live in `createTwoFactorMethods().verifyTwoFactorCode`. These tests
 * drive it through a fake model and the real auth/cache singletons.
 */
import { describe, expect, it } from 'bun:test'
import { generateTwoFactorSecret, generateTwoFactorToken } from '@stacksjs/auth'
import { createTwoFactorMethods } from '../src/traits/two-factor'

// Minimal model stand-in: only `get()` and a stable `id` are exercised.
function fakeModel(id: number, secret: string) {
  return {
    id,
    get: (key: string) => (key === 'two_factor_secret' ? secret : undefined),
  }
}

describe('verifyTwoFactorCode hardening', () => {
  it('accepts a valid code once, then rejects the replay', async () => {
    const { verifyTwoFactorCode } = createTwoFactorMethods()
    const secret = generateTwoFactorSecret()
    const model = fakeModel(9001, secret)
    const code = await generateTwoFactorToken(secret)

    // First submission of a freshly-generated code succeeds.
    expect(await verifyTwoFactorCode(model, code)).toBe(true)

    // Replaying the exact same code within its window is rejected even
    // though it is still cryptographically valid.
    expect(await verifyTwoFactorCode(model, code)).toBe(false)
  })

  it('returns false for an invalid code', async () => {
    const { verifyTwoFactorCode } = createTwoFactorMethods()
    const secret = generateTwoFactorSecret()
    const model = fakeModel(9002, secret)

    expect(await verifyTwoFactorCode(model, '000000')).toBe(false)
  })

  it('locks out after repeated invalid codes (HTTP 429)', async () => {
    const { verifyTwoFactorCode } = createTwoFactorMethods()
    const secret = generateTwoFactorSecret()
    const model = fakeModel(9003, secret)

    // 5 failed attempts trip the shared RateLimiter lockout.
    for (let i = 0; i < 5; i++)
      expect(await verifyTwoFactorCode(model, '000000')).toBe(false)

    // The 6th attempt is refused outright with a 429 rather than checked.
    let status: number | undefined
    try {
      await verifyTwoFactorCode(model, '000000')
    }
    catch (err: any) {
      status = err?.status ?? err?.statusCode
    }
    expect(status).toBe(429)
  })
})
