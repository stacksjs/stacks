export type { AuthToken } from '@stacksjs/types'
import { Buffer } from 'node:buffer'
import { createHmac, randomBytes } from 'node:crypto'
import process from 'node:process'

/**
 * `TokenManager` used to expose `createAccessToken` / `validateToken` /
 * `rotateToken` / `revokeToken` static methods that hardcoded a 30-day
 * `expires_at`, bypassed `config.auth.tokenExpiry`, and compared raw
 * tokens against DB-stored hashes (i.e. broken). They had no callers —
 * the real path lives on `Auth` (see authentication.ts) and respects
 * the configured 1-hour expiry plus the refresh-token rotation
 * landed for #1839. Removed entirely so the trap can't fire.
 *
 * `generateJWT` is the one piece worth keeping — `Auth.createTokenForUser`
 * and `Auth.rotateToken` both use it to mint the JWT body.
 */
export class TokenManager {
  /**
   * Generate a JWT-like token with embedded metadata
   * Contains user ID, timestamps, and random signature for security.
   *
   * @param userId - User ID to embed in the `sub` claim
   * @param expiresInSeconds - JWT expiry; defaults to 1 hour to match the
   *   short-lived access-token contract from `config.auth.tokenExpiry`.
   *   The previous 30-day default was a non-recoverable bearer-token
   *   model; callers should pass the resolved access-token TTL so the
   *   JWT `exp` claim matches the DB row's `expires_at`.
   */
  static generateJWT(userId: number, expiresInSeconds: number = 60 * 60): string {
    const appKey = process.env.APP_KEY
    if (!appKey) {
      throw new Error('APP_KEY is not set. JWT tokens cannot be generated without a secure application key.')
    }

    const header = {
      alg: 'HS256',
      typ: 'JWT',
    }

    const nowSeconds = Math.floor(Date.now() / 1000)
    const payload = {
      sub: userId,
      iat: nowSeconds,
      exp: nowSeconds + expiresInSeconds,
      jti: randomBytes(16).toString('hex'),
    }

    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url')
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
    const signature = createHmac('sha256', appKey)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url')

    return `${encodedHeader}.${encodedPayload}.${signature}`
  }
}
