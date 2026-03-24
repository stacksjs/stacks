import { beforeAll, describe, expect, test } from 'bun:test'
import { encrypt, decrypt } from '../src/crypt'

const TEST_APP_KEY = 'test-key-that-is-32-chars-long!!'

// Set APP_KEY for tests that use the default passphrase (config.app.key)
beforeAll(() => {
  process.env.APP_KEY = TEST_APP_KEY
})

// ---------------------------------------------------------------------------
// encrypt / decrypt round-trip
// ---------------------------------------------------------------------------
describe('encrypt and decrypt', () => {
  test('round-trip returns original string', async () => {
    const original = 'hello world'
    const encrypted = await encrypt(original, TEST_APP_KEY)
    const decrypted = await decrypt(encrypted, TEST_APP_KEY)
    expect(decrypted).toBe(original)
  })

  test('different strings produce different ciphertexts', async () => {
    const enc1 = await encrypt('string-one', TEST_APP_KEY)
    const enc2 = await encrypt('string-two', TEST_APP_KEY)
    expect(enc1).not.toBe(enc2)
  })

  test('empty string encrypts and decrypts successfully', async () => {
    const encrypted = await encrypt('', TEST_APP_KEY)
    const decrypted = await decrypt(encrypted, TEST_APP_KEY)
    expect(decrypted).toBe('')
  })

  test('unicode content works', async () => {
    const original = 'Hello \u4f60\u597d \u0645\u0631\u062d\u0628\u0627 \ud83c\udf0d'
    const encrypted = await encrypt(original, TEST_APP_KEY)
    const decrypted = await decrypt(encrypted, TEST_APP_KEY)
    expect(decrypted).toBe(original)
  })

  test('very long strings work', async () => {
    const original = 'a'.repeat(10000)
    const encrypted = await encrypt(original, TEST_APP_KEY)
    const decrypted = await decrypt(encrypted, TEST_APP_KEY)
    expect(decrypted).toBe(original)
  })

  test('special characters work', async () => {
    const original = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`"\'\\\n\t\r'
    const encrypted = await encrypt(original, TEST_APP_KEY)
    const decrypted = await decrypt(encrypted, TEST_APP_KEY)
    expect(decrypted).toBe(original)
  })

  test('encrypted output is a non-empty string', async () => {
    const encrypted = await encrypt('test', TEST_APP_KEY)
    expect(typeof encrypted).toBe('string')
    expect(encrypted.length).toBeGreaterThan(0)
  })

  test('encrypted output differs from plaintext', async () => {
    const original = 'plaintext-message'
    const encrypted = await encrypt(original, TEST_APP_KEY)
    expect(encrypted).not.toBe(original)
  })

  test('same plaintext encrypts to different ciphertext each time', async () => {
    const enc1 = await encrypt('identical', TEST_APP_KEY)
    const enc2 = await encrypt('identical', TEST_APP_KEY)
    expect(enc1).not.toBe(enc2)
  })
})

// ---------------------------------------------------------------------------
// custom passphrase
// ---------------------------------------------------------------------------
describe('custom passphrase', () => {
  test('round-trip with custom passphrase', async () => {
    const passphrase = 'my-custom-32-char-passphrase!!!!!'
    const original = 'secret data'
    const encrypted = await encrypt(original, passphrase)
    const decrypted = await decrypt(encrypted, passphrase)
    expect(decrypted).toBe(original)
  })

  test('wrong passphrase fails to decrypt', async () => {
    const encrypted = await encrypt('secret', 'correct-passphrase-32-chars!!!!!')
    await expect(
      decrypt(encrypted, 'wrong-passphrase-that-is-32-ch!!'),
    ).rejects.toThrow()
  })

  test('custom passphrase produces different ciphertext than another passphrase', async () => {
    const original = 'same-message'
    const encOne = await encrypt(original, TEST_APP_KEY)
    const encCustom = await encrypt(original, 'another-passphrase-32-chars-ok!!')
    expect(encOne).not.toBe(encCustom)
  })
})

// ---------------------------------------------------------------------------
// error handling
// ---------------------------------------------------------------------------
describe('error handling', () => {
  test('encrypt throws for non-string input (null)', async () => {
    await expect(encrypt(null as unknown as string)).rejects.toThrow()
  })

  test('encrypt throws for non-string input (undefined)', async () => {
    await expect(encrypt(undefined as unknown as string)).rejects.toThrow()
  })

  test('encrypt does not throw for number input (coerced by underlying crypto)', async () => {
    // The guard only catches falsy non-empty-string values;
    // a number like 123 is truthy, so it passes through to the crypto layer
    const result = await encrypt(123 as unknown as string, TEST_APP_KEY)
    expect(typeof result).toBe('string')
  })

  test('decrypt throws for empty encrypted input', async () => {
    await expect(decrypt('')).rejects.toThrow('decrypt() requires a non-empty encrypted string')
  })

  test('decrypt throws for null input', async () => {
    await expect(decrypt(null as unknown as string)).rejects.toThrow()
  })

  test('decrypt throws for undefined input', async () => {
    await expect(decrypt(undefined as unknown as string)).rejects.toThrow()
  })

  test('decrypt throws for invalid encrypted data', async () => {
    await expect(decrypt('not-valid-encrypted-data', TEST_APP_KEY)).rejects.toThrow()
  })
})
