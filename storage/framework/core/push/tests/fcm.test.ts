import { describe, expect, test } from 'bun:test'

/**
 * A JWS segment is base64url with the padding stripped: RFC 7515 section 2,
 * which RFC 7519 inherits for JWTs. Plain base64 is not interchangeable here -
 * Google's token endpoint rejects the assertion outright.
 */
const BASE64URL = /^[A-Za-z0-9_-]+$/

/** A throwaway RSA key in the PEM shape a Firebase service account file carries. */
async function generateServiceAccountKey(): Promise<string> {
  const pair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  ) as CryptoKeyPair

  const pkcs8 = await crypto.subtle.exportKey('pkcs8', pair.privateKey)
  const body = btoa(String.fromCharCode(...new Uint8Array(pkcs8)))
  return `-----BEGIN PRIVATE KEY-----\n${body.replace(/(.{64})/g, '$1\n')}\n-----END PRIVATE KEY-----\n`
}

function decodeSegment(segment: string): unknown {
  const padded = segment.padEnd(segment.length + ((4 - (segment.length % 4)) % 4), '=')
  return JSON.parse(atob(padded.replace(/-/g, '+').replace(/_/g, '/')))
}

describe('FCM service account assertion', () => {
  /**
   * These two addresses are not arbitrary. Under plain `btoa` the first one's
   * claim set encodes to a string ending in '=', and the second one's does not,
   * so a test that only used the second would pass against the bug. Sweeping
   * realistic service account addresses, about 65% land on the first shape -
   * and because the claim set's length is stable for a given account, an
   * affected deployment never authenticates rather than failing intermittently.
   */
  const PADS = 'push@acme-prod.iam.gserviceaccount.com'
  const CLEAN = 'firebase-adminsdk-abc12@my-stacks-app.iam.gserviceaccount.com'
  const NOW = 1791200000

  test.each([
    ['a claim set that needs base64 padding', PADS],
    ['a claim set that happens not to', CLEAN],
  ])('signs %s into three base64url segments', async (_label, clientEmail) => {
    const { buildServiceAccountAssertion } = await import('../src/drivers/fcm')
    const jwt = await buildServiceAccountAssertion(clientEmail, await generateServiceAccountKey(), NOW)

    const segments = jwt.split('.')
    expect(segments).toHaveLength(3)
    for (const segment of segments)
      expect(segment).toMatch(BASE64URL)
  })

  test('carries the claims Google requires for the firebase.messaging scope', async () => {
    const { buildServiceAccountAssertion } = await import('../src/drivers/fcm')
    const jwt = await buildServiceAccountAssertion(PADS, await generateServiceAccountKey(), NOW)

    expect(decodeSegment(jwt.split('.')[0])).toEqual({ alg: 'RS256', typ: 'JWT' })
    expect(decodeSegment(jwt.split('.')[1])).toEqual({
      iss: PADS,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: NOW,
      exp: NOW + 3600,
    })
  })

  test('accepts a PEM whose base64 body is wrapped across lines', async () => {
    const { buildServiceAccountAssertion } = await import('../src/drivers/fcm')
    const pem = await generateServiceAccountKey()
    expect(pem).toContain('\n')
    await expect(buildServiceAccountAssertion(CLEAN, pem, NOW)).resolves.toBeString()
  })
})
