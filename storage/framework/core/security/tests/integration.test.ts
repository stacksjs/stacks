import { describe, expect, test } from 'bun:test'
import { argon2Encode, bcryptEncode, check, detectAlgorithm, info, make, needsRehash } from '../src/hash'
import { decrypt, encrypt } from '../src/crypt'
import { generateAppKey } from '../src/key'

describe('Security Integration', () => {
  describe('Password hashing round-trips', () => {
    test('bcrypt: hash then verify succeeds', async () => {
      const password = 'MySecretPassword123!'
      const hash = await make(password, { algorithm: 'bcrypt', rounds: 4 })
      expect(hash).toStartWith('$2')
      expect(await check(password, hash)).toBe(true)
      expect(await check('wrong-password', hash)).toBe(false)
    })

    test('argon2id: hash then verify succeeds', async () => {
      const password = 'AnotherSecret456'
      const hash = await make(password, { algorithm: 'argon2id' })
      expect(hash).toStartWith('$argon2id$')
      expect(await check(password, hash)).toBe(true)
      expect(await check('wrong', hash)).toBe(false)
    })

    test('needsRehash detects algorithm change', async () => {
      const bcryptHash = await bcryptEncode('test', 4)
      // If config says argon2id but hash is bcrypt, needs rehash
      expect(needsRehash(bcryptHash, { algorithm: 'argon2id' })).toBe(true)
      // Same algorithm, same rounds — no rehash
      expect(needsRehash(bcryptHash, { algorithm: 'bcrypt', rounds: 4 })).toBe(false)
    })

    test('needsRehash detects rounds change', async () => {
      const hash = await bcryptEncode('test', 4)
      expect(needsRehash(hash, { algorithm: 'bcrypt', rounds: 10 })).toBe(true)
    })

    test('info extracts correct algorithm and params', async () => {
      const bcryptHash = await bcryptEncode('test', 4)
      const bcryptInfo = info(bcryptHash)
      expect(bcryptInfo.algorithm).toBe('bcrypt')
      expect(bcryptInfo.options.rounds).toBe(4)

      const argonHash = await argon2Encode('test')
      const argonInfo = info(argonHash)
      expect(argonInfo.algorithm).toBe('argon2id')
      expect(argonInfo.options.memory).toBeGreaterThan(0)
    })

    test('different passwords produce different hashes', async () => {
      const h1 = await make('password1', { algorithm: 'bcrypt', rounds: 4 })
      const h2 = await make('password2', { algorithm: 'bcrypt', rounds: 4 })
      expect(h1).not.toBe(h2)
    })

    test('same password produces different hashes (salted)', async () => {
      const h1 = await make('samepass', { algorithm: 'bcrypt', rounds: 4 })
      const h2 = await make('samepass', { algorithm: 'bcrypt', rounds: 4 })
      expect(h1).not.toBe(h2) // different salt each time
      // But both verify correctly
      expect(await check('samepass', h1)).toBe(true)
      expect(await check('samepass', h2)).toBe(true)
    })

    test('detectAlgorithm identifies bcrypt hashes', async () => {
      const hash = await bcryptEncode('test', 4)
      expect(detectAlgorithm(hash)).toBe('bcrypt')
    })

    test('detectAlgorithm identifies argon2id hashes', async () => {
      const hash = await argon2Encode('test')
      expect(detectAlgorithm(hash)).toBe('argon2id')
    })

    test('detectAlgorithm returns unknown for garbage input', () => {
      expect(detectAlgorithm('not-a-hash')).toBe('unknown')
      expect(detectAlgorithm('')).toBe('unknown')
    })

    test('check returns false for empty inputs', async () => {
      expect(await check('', 'somehash')).toBe(false)
      expect(await check('password', '')).toBe(false)
    })
  })

  describe('Encryption round-trips', () => {
    test('encrypt then decrypt returns original', async () => {
      const key = generateAppKey()
      const original = 'sensitive data here'
      const encrypted = await encrypt(original, key)
      expect(encrypted).not.toBe(original)
      const decrypted = await decrypt(encrypted, key)
      expect(decrypted).toBe(original)
    })

    test('unicode round-trip', async () => {
      const key = generateAppKey()
      const original = 'Japanese test: \u65E5\u672C\u8A9E and accents: \u00E9\u00E8\u00EA'
      const encrypted = await encrypt(original, key)
      const decrypted = await decrypt(encrypted, key)
      expect(decrypted).toBe(original)
    })

    test('wrong key fails to decrypt', async () => {
      const key1 = generateAppKey()
      const key2 = generateAppKey()
      const encrypted = await encrypt('secret', key1)
      await expect(decrypt(encrypted, key2)).rejects.toThrow()
    })

    test('empty string round-trip', async () => {
      const key = generateAppKey()
      const encrypted = await encrypt('', key)
      const decrypted = await decrypt(encrypted, key)
      expect(decrypted).toBe('')
    })

    test('long string round-trip', async () => {
      const key = generateAppKey()
      const original = 'x'.repeat(10000)
      const encrypted = await encrypt(original, key)
      const decrypted = await decrypt(encrypted, key)
      expect(decrypted).toBe(original)
    })
  })

  describe('Key generation', () => {
    test('generates unique keys', () => {
      const keys = new Set(Array.from({ length: 20 }, () => generateAppKey()))
      expect(keys.size).toBe(20)
    })

    test('generated key works for encrypt/decrypt', async () => {
      const key = generateAppKey()
      const msg = 'round-trip with generated key'
      const enc = await encrypt(msg, key)
      const dec = await decrypt(enc, key)
      expect(dec).toBe(msg)
    })
  })
})
