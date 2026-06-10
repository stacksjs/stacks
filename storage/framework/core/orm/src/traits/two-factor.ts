// A code is valid for at most (2 * window + 1) time-steps. With the ts-auth
// defaults (step=30s, window=1) that's three 30s steps → ~90s of validity.
// The replay marker only needs to outlive that window.
const TWO_FACTOR_CODE_VALIDITY_SECONDS = 90

export function createTwoFactorMethods() {
  return {
    async generateTwoFactorForModel(model: any): Promise<void> {
      const { generateTwoFactorSecret } = await import('@stacksjs/auth')
      const secret = generateTwoFactorSecret()
      await model.update({ two_factor_secret: secret })
    },

    /**
     * Verify a submitted TOTP code for a model.
     *
     * Beyond the raw cryptographic check this adds the two protections a 2FA
     * verifier needs but the bare TOTP primitive lacks:
     *
     *  1. **Rate limiting.** Without a throttle, an attacker who already has
     *     the password can brute-force the ~1e6 code space. Verification is
     *     gated through the shared `RateLimiter` (5 attempts → 15-min lockout)
     *     under a per-identity, 2FA-specific key, and throws HTTP 429 on
     *     lockout — mirroring the password login paths.
     *
     *  2. **Replay protection.** A valid code stays valid for its whole ~90s
     *     window, so a captured/phished code could be replayed within it. The
     *     first acceptance records the consumed code in the cache keyed per
     *     identity; a second submission of the same code is rejected. Keyed on
     *     the code value (TOTP codes are distinct across adjacent steps) so it
     *     needs no schema column. If the cache backend is unavailable we fail
     *     open on replay only — the code was already cryptographically valid,
     *     and we don't want a cache outage to lock out legitimate logins.
     */
    async verifyTwoFactorCode(model: any, code: string): Promise<boolean> {
      const modelTwoFactorSecret = model.get('two_factor_secret')
      if (typeof modelTwoFactorSecret !== 'string')
        return false

      const { verifyTwoFactorCode, RateLimiter } = await import('@stacksjs/auth')

      // Stable per-identity key, distinct from the password-login limiter.
      const identity = String(model.id ?? model.get?.('id') ?? model.get?.('email') ?? modelTwoFactorSecret)
      const rlKey = `2fa:${identity}`

      if (await RateLimiter.isRateLimited(rlKey)) {
        const { HttpError } = await import('@stacksjs/error-handling')
        throw new HttpError(429, 'Too many verification attempts. Please try again later.')
      }

      const valid = await verifyTwoFactorCode(code, modelTwoFactorSecret)
      if (!valid) {
        await RateLimiter.recordFailedAttempt(rlKey)
        return false
      }

      // Replay guard: reject a code that was already consumed in its window.
      try {
        const { cache } = await import('@stacksjs/cache')
        const replayKey = `2fa:used:${identity}:${code}`
        if (await cache.has(replayKey)) {
          await RateLimiter.recordFailedAttempt(rlKey)
          return false
        }
        await cache.set(replayKey, '1', TWO_FACTOR_CODE_VALIDITY_SECONDS)
      }
      catch {
        // Cache unavailable — fail open on replay only (see method docs).
      }

      await RateLimiter.resetAttempts(rlKey)
      return true
    },
  }
}
