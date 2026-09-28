import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

const VERIFIER_PATTERN = /^[A-Za-z0-9\-._~]{43,128}$/
const S256_CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43}$/

/** Whether a value is an RFC 7636 code verifier. */
export function isValidPkceVerifier(value: unknown): value is string {
  return typeof value === 'string' && VERIFIER_PATTERN.test(value)
}

/** Generate a 256-bit, 43-character RFC 7636 verifier. */
export function generatePkceVerifier(): string {
  return randomBytes(32).toString('base64url')
}

/** Derive the required S256 challenge from a validated verifier. */
export async function createS256CodeChallenge(verifier: string): Promise<string> {
  if (!isValidPkceVerifier(verifier))
    throw new TypeError('PKCE verifier must be 43 to 128 RFC 7636 unreserved characters.')

  return createHash('sha256').update(verifier, 'ascii').digest('base64url')
}

/**
 * Verify an S256 challenge without supporting the insecure plain method.
 * Malformed protocol input returns false instead of reaching the hash compare.
 */
export async function verifyS256CodeChallenge(
  verifier: string,
  expectedChallenge: string,
): Promise<boolean> {
  if (!isValidPkceVerifier(verifier) || !S256_CHALLENGE_PATTERN.test(expectedChallenge))
    return false

  const actual = await createS256CodeChallenge(verifier)
  return timingSafeEqual(Buffer.from(actual, 'ascii'), Buffer.from(expectedChallenge, 'ascii'))
}
