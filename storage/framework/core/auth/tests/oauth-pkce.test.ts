import { describe, expect, it } from 'bun:test'
import {
  createS256CodeChallenge,
  generatePkceVerifier,
  isValidPkceVerifier,
  verifyS256CodeChallenge,
} from '../src/oauth-pkce'

describe('OAuth S256 PKCE', () => {
  it('matches the RFC 7636 reference vector', async () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
    const challenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'

    expect(await createS256CodeChallenge(verifier)).toBe(challenge)
    expect(await verifyS256CodeChallenge(verifier, challenge)).toBe(true)
    expect(await verifyS256CodeChallenge(`${verifier}x`, challenge)).toBe(false)
  })

  it('accepts only RFC 7636 verifier syntax and length', () => {
    expect(isValidPkceVerifier('a'.repeat(43))).toBe(true)
    expect(isValidPkceVerifier('A0-._~'.repeat(21).slice(0, 128))).toBe(true)
    expect(isValidPkceVerifier('a'.repeat(42))).toBe(false)
    expect(isValidPkceVerifier('a'.repeat(129))).toBe(false)
    expect(isValidPkceVerifier(`${'a'.repeat(42)}=`)).toBe(false)
    expect(isValidPkceVerifier(`${'a'.repeat(42)}!`)).toBe(false)
  })

  it('generates a verifier that survives a complete challenge exchange', async () => {
    const verifier = generatePkceVerifier()
    const challenge = await createS256CodeChallenge(verifier)

    expect(isValidPkceVerifier(verifier)).toBe(true)
    expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(await verifyS256CodeChallenge(verifier, challenge)).toBe(true)
  })

  it('rejects malformed verifier and challenge input without downgrading to plain', async () => {
    await expect(createS256CodeChallenge('too-short')).rejects.toThrow('PKCE verifier')
    expect(await verifyS256CodeChallenge('too-short', 'a'.repeat(43))).toBe(false)
    expect(await verifyS256CodeChallenge('a'.repeat(43), 'not base64url=')).toBe(false)
  })
})
