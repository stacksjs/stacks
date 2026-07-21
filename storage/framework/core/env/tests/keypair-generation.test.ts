import { describe, expect, test } from 'bun:test'
import { decryptValue, encryptValue, generateKeypair } from '../src/crypto'

// stacksjs/stacks#1053 — verifies the keypair shape that `buddy key:generate`
// writes into `.env` is round-trip valid: a value encrypted with the public
// key decrypts back through the matching private key.

describe('generateKeypair (#1053 default-encryption keypair)', () => {
  test('returns versioned X25519 public + private keys', () => {
    const { publicKey, privateKey } = generateKeypair()
    expect(publicKey).toMatch(/^x25519-public:[A-Za-z0-9_-]+$/)
    expect(privateKey).toMatch(/^x25519-private:[A-Za-z0-9_-]+$/)
  })

  test('every keypair is unique', () => {
    const a = generateKeypair()
    const b = generateKeypair()
    expect(a.publicKey).not.toBe(b.publicKey)
    expect(a.privateKey).not.toBe(b.privateKey)
  })

  test('encrypt with public key → decrypt with private key round-trip', () => {
    const { publicKey, privateKey } = generateKeypair()
    const secret = 'sk_live_top_secret_value'

    const encrypted = encryptValue(secret, publicKey)
    expect(encrypted.startsWith('encrypted:v2:')).toBe(true)

    const recovered = decryptValue(encrypted, privateKey)
    expect(recovered).toBe(secret)
  })

  test('a private key from a different keypair cannot decrypt', () => {
    const { publicKey } = generateKeypair()
    const { privateKey: foreignPrivate } = generateKeypair()
    const encrypted = encryptValue('hello', publicKey)
    expect(() => decryptValue(encrypted, foreignPrivate)).toThrow()
  })
})
