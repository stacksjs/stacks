import { describe, expect, mock, test } from 'bun:test'

// Mock config with a 32-char app key
mock.module('@stacksjs/config', () => ({
  config: {
    app: {
      key: 'test-key-that-is-32-chars-long!!',
    },
  },
}))

const { encrypt, decrypt } = await import('../src/crypt')

// ---------------------------------------------------------------------------
// encrypt / decrypt round-trip
// ---------------------------------------------------------------------------
describe('encrypt and decrypt', () => {
  test('round-trip returns original string', async () => {
    const original = 'hello world'
    const encrypted = await encrypt(original)
    const decrypted = await decrypt(encrypted)
    expect(decrypted).toBe(original)
  })

  test('different strings produce different ciphertexts', async () => {
    const enc1 = await encrypt('string-one')
    const enc2 = await encrypt('string-two')
    expect(enc1).not.toBe(enc2)
  })

  test('empty string encrypts and decrypts successfully', async () => {
    const encrypted = await encrypt('')
    const decrypted = await decrypt(encrypted)
    expect(decrypted).toBe('')
  })

  test('unicode content works', async () => {
    const original = 'Hello 你好 مرحبا 🌍'
    const encrypted = await encrypt(original)
    const decrypted = await decrypt(encrypted)
    expect(decrypted).toBe(original)
  })

  test('very long strings work', async () => {
    const original = 'a'.repeat(10000)
    const encrypted = await encrypt(original)
    const decrypted = await decrypt(encrypted)
    expect(decrypted).toBe(original)
  })

  test('special characters work', async () => {
    const original = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`"\'\\\n\t\r'
    const encrypted = await encrypt(original)
    const decrypted = await decrypt(encrypted)
    expect(decrypted).toBe(original)
  })

  test('encrypted output is a non-empty string', async () => {
    const encrypted = await encrypt('test')
    expect(typeof encrypted).toBe('string')
    expect(encrypted.length).toBeGreaterThan(0)
  })

  test('encrypted output differs from plaintext', async () => {
    const original = 'plaintext-message'
    const encrypted = await encrypt(original)
    expect(encrypted).not.toBe(original)
  })

  test('same plaintext encrypts to different ciphertext each time', async () => {
    const enc1 = await encrypt('identical')
    const enc2 = await encrypt('identical')
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

  test('custom passphrase produces different ciphertext than default key', async () => {
    const original = 'same-message'
    const encDefault = await encrypt(original)
    const encCustom = await encrypt(original, 'another-passphrase-32-chars-ok!!')
    expect(encDefault).not.toBe(encCustom)
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
    const result = await encrypt(123 as unknown as string)
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
    await expect(decrypt('not-valid-encrypted-data')).rejects.toThrow()
  })
})
