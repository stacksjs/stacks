import { Buffer } from 'node:buffer'
import { describe, expect, test } from 'bun:test'
import { decrypt, encrypt } from '../src/crypt'

/**
 * stacksjs/stacks#2910 — PBKDF2 at 600k iterations over an APP_KEY that is
 * already 32 uniformly random bytes buys nothing and costs ~46ms a call.
 * V2 derives with HKDF instead. These pin which envelope each kind of key
 * produces, that V1 stays readable, and that a passphrase still gets the
 * stretching it actually needs.
 */

const RANDOM_KEY = `base64:${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64')}`
const PASSPHRASE = 'a human chose this one'

/** The byte that says which envelope this is. */
function version(ciphertext: string): number {
  return Buffer.from(ciphertext, 'base64')[0]!
}

describe('encryption envelope selection', () => {
  test('a random app key mints V2', async () => {
    expect(version(await encrypt('hello', RANDOM_KEY))).toBe(0x02)
  })

  test('a passphrase still mints V1, because the stretching is doing work there', async () => {
    expect(version(await encrypt('hello', PASSPHRASE))).toBe(0x01)
  })

  test('both round trip', async () => {
    expect(await decrypt(await encrypt('hello', RANDOM_KEY), RANDOM_KEY)).toBe('hello')
    expect(await decrypt(await encrypt('hello', PASSPHRASE), PASSPHRASE)).toBe('hello')
  })

  test('an empty string survives the round trip', async () => {
    expect(await decrypt(await encrypt('', RANDOM_KEY), RANDOM_KEY)).toBe('')
  })

  test('unicode survives the round trip', async () => {
    const message = 'héllo wörld 🔐 日本語'
    expect(await decrypt(await encrypt(message, RANDOM_KEY), RANDOM_KEY)).toBe(message)
  })

  test('every ciphertext gets its own salt and IV', async () => {
    const first = Buffer.from(await encrypt('same', RANDOM_KEY), 'base64')
    const second = Buffer.from(await encrypt('same', RANDOM_KEY), 'base64')
    expect(first.subarray(1, 29).equals(second.subarray(1, 29))).toBe(false)
  })

  test('the wrong key does not decrypt a V2 ciphertext', async () => {
    const other = `base64:${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64')}`
    await expect(decrypt(await encrypt('secret', RANDOM_KEY), other)).rejects.toThrow()
  })

  test('a tampered V2 ciphertext is refused, not returned', async () => {
    const raw = Buffer.from(await encrypt('secret', RANDOM_KEY), 'base64')
    raw[raw.length - 1] ^= 0xFF
    await expect(decrypt(raw.toString('base64'), RANDOM_KEY)).rejects.toThrow()
  })
})

describe('ciphertexts written before this change', () => {
  // A real V1 envelope, built by the pre-#2910 derivation and frozen here.
  // Regenerating it from the current code would assert nothing.
  const V1_KEY = 'base64:qV8mN3pR7sT1uW5xY9zA2bC4dE6fG8hJ0kL2mN4oP6Q='
  const V1_CIPHERTEXT = 'AQcHBwcHBwcHBwcHBwcHBwcJCQkJCQkJCQkJCQk9axMLsMvrc+iEApPvJjSQBZEjCNnWKFMb32JwqfsDeg=='

  test('still decrypt, under the same random app key that now mints V2', async () => {
    expect(version(V1_CIPHERTEXT)).toBe(0x01)
    expect(await decrypt(V1_CIPHERTEXT, V1_KEY)).toBe('written under v1')
  })

  test('and the same key writes V2 from now on', async () => {
    expect(version(await encrypt('written under v2', V1_KEY))).toBe(0x02)
  })
})
