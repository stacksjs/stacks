/**
 * Comprehensive tests for crypto functions
 * Uses hardcoded keys for deterministic testing
 */

import { describe, expect, it } from 'bun:test'
import { createHash } from 'node:crypto'
import { aesDecrypt, aesEncrypt, decryptValue, encryptValue, generateKeypair, getPrivateKey, isLegacyEncryptedValue, migrateEncryptedValue, parseEnvFromKey } from '../src/crypto'

// Hardcoded test keys for deterministic testing
const TEST_PRIVATE_KEY = 'a4547dcd9d3429615a3649bb79e87edb62ee6a74b007075e9141ae44f5fb412c'

describe('Crypto - AES Encryption/Decryption', () => {
  it('should encrypt and decrypt a simple string', () => {
    const plaintext = 'Hello, World!'
    const key = Buffer.from(TEST_PRIVATE_KEY, 'hex')

    const { ciphertext, iv, authTag } = aesEncrypt(plaintext, key)

    expect(ciphertext).toBeDefined()
    expect(iv).toBeDefined()
    expect(authTag).toBeDefined()
    expect(ciphertext).not.toBe(plaintext)

    const decrypted = aesDecrypt(ciphertext, key, iv, authTag)
    expect(decrypted).toBe(plaintext)
  })

  it('should encrypt and decrypt a long string', () => {
    const plaintext = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(10)
    const key = Buffer.from(TEST_PRIVATE_KEY, 'hex')

    const { ciphertext, iv, authTag } = aesEncrypt(plaintext, key)
    const decrypted = aesDecrypt(ciphertext, key, iv, authTag)

    expect(decrypted).toBe(plaintext)
  })

  it('should encrypt and decrypt special characters', () => {
    const plaintext = '!@#$%^&*()_+-={}[]|\\:";\'<>?,./~`'
    const key = Buffer.from(TEST_PRIVATE_KEY, 'hex')

    const { ciphertext, iv, authTag } = aesEncrypt(plaintext, key)
    const decrypted = aesDecrypt(ciphertext, key, iv, authTag)

    expect(decrypted).toBe(plaintext)
  })

  it('should encrypt and decrypt unicode characters', () => {
    const plaintext = '你好世界 🌍 émojis ñ'
    const key = Buffer.from(TEST_PRIVATE_KEY, 'hex')

    const { ciphertext, iv, authTag } = aesEncrypt(plaintext, key)
    const decrypted = aesDecrypt(ciphertext, key, iv, authTag)

    expect(decrypted).toBe(plaintext)
  })

  it('should produce different ciphertext for same plaintext (random IV)', () => {
    const plaintext = 'Same text'
    const key = Buffer.from(TEST_PRIVATE_KEY, 'hex')

    const result1 = aesEncrypt(plaintext, key)
    const result2 = aesEncrypt(plaintext, key)

    // Different IVs should produce different ciphertexts
    expect(result1.iv).not.toBe(result2.iv)
    expect(result1.ciphertext).not.toBe(result2.ciphertext)

    // But both should decrypt to the same plaintext
    expect(aesDecrypt(result1.ciphertext, key, result1.iv, result1.authTag)).toBe(plaintext)
    expect(aesDecrypt(result2.ciphertext, key, result2.iv, result2.authTag)).toBe(plaintext)
  })

  it('should fail to decrypt with wrong key', () => {
    const plaintext = 'Secret'
    const key1 = Buffer.from(TEST_PRIVATE_KEY, 'hex')
    const key2 = Buffer.from('b5658ece0e4540726b465abb8ace98fc73ef85a5c108186f0252bf55f0fc523d', 'hex')

    const { ciphertext, iv, authTag } = aesEncrypt(plaintext, key1)

    expect(() => {
      aesDecrypt(ciphertext, key2, iv, authTag)
    }).toThrow()
  })

  it('should fail to decrypt with wrong auth tag', () => {
    const plaintext = 'Secret'
    const key = Buffer.from(TEST_PRIVATE_KEY, 'hex')

    const { ciphertext, iv } = aesEncrypt(plaintext, key)
    const wrongAuthTag = '00000000000000000000000000000000'

    expect(() => {
      aesDecrypt(ciphertext, key, iv, wrongAuthTag)
    }).toThrow()
  })
})

describe('Crypto - Keypair Generation', () => {
  it('should generate a valid keypair', () => {
    const { publicKey, privateKey } = generateKeypair()

    expect(publicKey).toBeDefined()
    expect(privateKey).toBeDefined()
    expect(publicKey).toStartWith('x25519-public:')
    expect(privateKey).toStartWith('x25519-private:')
    expect(publicKey).not.toBe(privateKey)
  })

  it('should generate different keypairs each time', () => {
    const keypair1 = generateKeypair()
    const keypair2 = generateKeypair()

    expect(keypair1.publicKey).not.toBe(keypair2.publicKey)
    expect(keypair1.privateKey).not.toBe(keypair2.privateKey)
  })

  it('should generate canonical versioned key encodings', () => {
    const { publicKey, privateKey } = generateKeypair()

    expect(publicKey.slice('x25519-public:'.length)).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(privateKey.slice('x25519-private:'.length)).toMatch(/^[A-Za-z0-9_-]+$/)
  })
})

describe('Crypto - Value Encryption/Decryption', () => {
  it('should encrypt and decrypt with generated keypair', () => {
    const value = 'my-secret-password-123'
    const { publicKey, privateKey } = generateKeypair()

    const encrypted = encryptValue(value, publicKey)
    expect(encrypted).toStartWith('encrypted:v2:')
    expect(encrypted).not.toContain(value)

    const decrypted = decryptValue(encrypted, privateKey)
    expect(decrypted).toBe(value)
  })

  it('should return plaintext if not encrypted', () => {
    const plaintext = 'not-encrypted'
    const { privateKey } = generateKeypair()

    const result = decryptValue(plaintext, privateKey)
    expect(result).toBe(plaintext)
  })

  it('should handle empty string', () => {
    const value = ''
    const { publicKey, privateKey } = generateKeypair()

    const encrypted = encryptValue(value, publicKey)
    const decrypted = decryptValue(encrypted, privateKey)

    expect(decrypted).toBe(value)
  })

  it('should handle very long values', () => {
    const value = 'x'.repeat(10000)
    const { publicKey, privateKey } = generateKeypair()

    const encrypted = encryptValue(value, publicKey)
    const decrypted = decryptValue(encrypted, privateKey)

    expect(decrypted).toBe(value)
  })

  it('should handle values with newlines', () => {
    const value = 'line1\nline2\nline3'
    const { publicKey, privateKey } = generateKeypair()

    const encrypted = encryptValue(value, publicKey)
    const decrypted = decryptValue(encrypted, privateKey)

    expect(decrypted).toBe(value)
  })

  it('should handle JSON strings', () => {
    const value = JSON.stringify({ key: 'value', nested: { foo: 'bar' } })
    const { publicKey, privateKey } = generateKeypair()

    const encrypted = encryptValue(value, publicKey)
    const decrypted = decryptValue(encrypted, privateKey)

    expect(decrypted).toBe(value)
    expect(JSON.parse(decrypted)).toEqual(JSON.parse(value))
  })
})

describe('Crypto - E2E with Hardcoded Keys', () => {
  // These test vectors ensure backward compatibility
  const HARDCODED_PRIVATE_KEY = 'a4547dcd9d3429615a3649bb79e87edb62ee6a74b007075e9141ae44f5fb412c'

  it('should encrypt with known key', () => {
    const value = 'test-value-123'
    const { publicKey } = generateKeypair()

    const encrypted = encryptValue(value, publicKey)

    expect(encrypted).toStartWith('encrypted:v2:')
    expect(encrypted.length).toBeGreaterThan(20)
    // Encrypted value should be base64 after "encrypted:" prefix
    const base64Part = encrypted.slice('encrypted:v2:'.length)
    expect(base64Part).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('should decrypt with known key', () => {
    const originalValue = 'my-database-password'
    const { publicKey, privateKey } = generateKeypair()

    // Encrypt with public key
    const encrypted = encryptValue(originalValue, publicKey)

    // Decrypt with private key
    const decrypted = decryptValue(encrypted, privateKey)

    expect(decrypted).toBe(originalValue)
  })

  it('should handle multiple encryptions with same key', () => {
    const values = [
      'secret1',
      'secret2',
      'secret3',
    ]
    const { publicKey, privateKey } = generateKeypair()

    const encrypted = values.map(v => encryptValue(v, publicKey))
    const decrypted = encrypted.map(e => decryptValue(e, privateKey))

    expect(decrypted).toEqual(values)
  })

  it('should preserve exact value through encrypt/decrypt cycle', () => {
    const testCases = [
      'simple',
      'with spaces',
      'with-dashes',
      'with_underscores',
      'with123numbers',
      'UPPERCASE',
      'MixedCase',
      'special!@#$%',
      'email@example.com',
      'https://example.com',
      'jdbc:postgresql://localhost:5432/db',
      '{"json": "value"}',
      'multi\nline\nvalue',
      '',
      ' ',
      '\t\n\r',
    ]

    const { publicKey, privateKey } = generateKeypair()

    for (const testCase of testCases) {
      const encrypted = encryptValue(testCase, publicKey)
      const decrypted = decryptValue(encrypted, privateKey)
      expect(decrypted).toBe(testCase)
    }
  })
})

describe('Crypto - Versioned Envelope Security', () => {
  function mutate(encrypted: string, field: string): string {
    const prefix = 'encrypted:v2:'
    const envelope = JSON.parse(Buffer.from(encrypted.slice(prefix.length), 'base64url').toString('utf8'))
    envelope[field] = field === 'v' ? 3 : `${envelope[field]}A`
    return `${prefix}${Buffer.from(JSON.stringify(envelope)).toString('base64url')}`
  }

  it('rejects wrong recipients and modified authenticated components generically', () => {
    const recipient = generateKeypair()
    const foreign = generateKeypair()
    const encrypted = encryptValue('secret', recipient.publicKey)
    expect(() => decryptValue(encrypted, foreign.privateKey)).toThrow('authentication or format error')
    for (const field of ['epk', 'salt', 'nonce', 'ciphertext', 'tag', 'v'])
      expect(() => decryptValue(mutate(encrypted, field), recipient.privateKey)).toThrow('authentication or format error')
  })

  it('rejects malformed envelopes and unknown fields', () => {
    const keys = generateKeypair()
    expect(() => decryptValue('encrypted:v2:not+base64', keys.privateKey)).toThrow('authentication or format error')
    const envelope = JSON.parse(Buffer.from(encryptValue('secret', keys.publicKey).slice('encrypted:v2:'.length), 'base64url').toString('utf8'))
    envelope.debug = true
    const value = `encrypted:v2:${Buffer.from(JSON.stringify(envelope)).toString('base64url')}`
    expect(() => decryptValue(value, keys.privateKey)).toThrow('authentication or format error')
  })

  it('enforces canonical base64url and exact component lengths', () => {
    const keys = generateKeypair()
    const encrypted = encryptValue('secret', keys.publicKey)
    const open = () => JSON.parse(Buffer.from(encrypted.slice('encrypted:v2:'.length), 'base64url').toString('utf8'))
    const reseal = (envelope: Record<string, unknown>) => `encrypted:v2:${Buffer.from(JSON.stringify(envelope)).toString('base64url')}`

    // Non-canonical (padded) base64url is rejected, closing malleability.
    const padded = open()
    padded.salt = `${padded.salt}=`
    expect(() => decryptValue(reseal(padded), keys.privateKey)).toThrow('authentication or format error')

    // Fixed-width components (salt=16, nonce=12, tag=16) reject a short but
    // otherwise canonical value, so a truncated field can't slip through.
    for (const field of ['salt', 'nonce', 'tag']) {
      const short = open()
      short[field] = Buffer.from('short').toString('base64url')
      expect(() => decryptValue(reseal(short), keys.privateKey)).toThrow('authentication or format error')
    }
  })

  it('reads and migrates legacy ciphertext but never writes it', () => {
    const legacyPrivate = TEST_PRIVATE_KEY
    const legacyPublic = createHash('sha256').update(Buffer.from(legacyPrivate, 'hex')).digest()
    const legacyKey = createHash('sha256').update(legacyPublic).digest()
    const { ciphertext, iv, authTag } = aesEncrypt('legacy-secret', legacyKey)
    const legacy = `encrypted:${Buffer.concat([Buffer.from(iv, 'hex'), Buffer.from(authTag, 'hex'), Buffer.from(ciphertext, 'hex')]).toString('base64')}`
    expect(isLegacyEncryptedValue(legacy)).toBe(true)
    expect(decryptValue(legacy, legacyPrivate)).toBe('legacy-secret')
    const replacement = generateKeypair()
    const migrated = migrateEncryptedValue(legacy, legacyPrivate, replacement.publicKey)
    expect(migrated).toStartWith('encrypted:v2:')
    expect(decryptValue(migrated, replacement.privateKey)).toBe('legacy-secret')
    expect(() => encryptValue('new-secret', legacyPublic.toString('hex'))).toThrow('env:rotate')
  })
})

describe('Crypto - Environment Key Helpers', () => {
  it('should parse environment from key name', () => {
    expect(parseEnvFromKey('DOTENV_PRIVATE_KEY')).toBe('')
    expect(parseEnvFromKey('DOTENV_PRIVATE_KEY_PRODUCTION')).toBe('production')
    expect(parseEnvFromKey('DOTENV_PRIVATE_KEY_CI')).toBe('ci')
    expect(parseEnvFromKey('DOTENV_PRIVATE_KEY_STAGING')).toBe('staging')
    expect(parseEnvFromKey('DOTENV_PRIVATE_KEY_DEVELOPMENT')).toBe('development')
  })

  it('should get private key from environment', () => {
    const originalEnv = process.env.DOTENV_PRIVATE_KEY

    process.env.DOTENV_PRIVATE_KEY = 'test-key'
    expect(getPrivateKey()).toBe('test-key')

    delete process.env.DOTENV_PRIVATE_KEY
    expect(getPrivateKey()).toBeUndefined()

    // Restore
    if (originalEnv) {
      process.env.DOTENV_PRIVATE_KEY = originalEnv
    }
  })

  it('should get environment-specific private key', () => {
    const originalEnv = process.env.DOTENV_PRIVATE_KEY_PRODUCTION

    process.env.DOTENV_PRIVATE_KEY_PRODUCTION = 'prod-key'
    expect(getPrivateKey('production')).toBe('prod-key')

    delete process.env.DOTENV_PRIVATE_KEY_PRODUCTION
    expect(getPrivateKey('production')).toBeUndefined()

    // Restore
    if (originalEnv) {
      process.env.DOTENV_PRIVATE_KEY_PRODUCTION = originalEnv
    }
  })
})
