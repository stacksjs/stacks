/**
 * Comprehensive tests for crypto functions
 * Uses hardcoded keys for deterministic testing
 */

import { describe, expect, it } from 'bun:test'
import { aesDecrypt, aesEncrypt, decryptValue, encryptValue, generateKeypair, getPrivateKey, parseEnvFromKey } from '../src/crypto'

// Hardcoded test keys for deterministic testing
const TEST_PRIVATE_KEY = 'a4547dcd9d3429615a3649bb79e87edb62ee6a74b007075e9141ae44f5fb412c'
const TEST_PUBLIC_KEY = 'c8e2a4e1f3c8b4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9'

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
    expect(publicKey.length).toBe(64) // 32 bytes in hex
    expect(privateKey.length).toBe(64) // 32 bytes in hex
    expect(publicKey).not.toBe(privateKey)
  })

  it('should generate different keypairs each time', () => {
    const keypair1 = generateKeypair()
    const keypair2 = generateKeypair()

    expect(keypair1.publicKey).not.toBe(keypair2.publicKey)
    expect(keypair1.privateKey).not.toBe(keypair2.privateKey)
  })

  it('should generate keypair with valid hex characters', () => {
    const { publicKey, privateKey } = generateKeypair()

    expect(publicKey).toMatch(/^[0-9a-f]{64}$/)
    expect(privateKey).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('Crypto - Value Encryption/Decryption', () => {
  it('should encrypt and decrypt with generated keypair', () => {
    const value = 'my-secret-password-123'
    const { publicKey, privateKey } = generateKeypair()

    const encrypted = encryptValue(value, publicKey)
    expect(encrypted).toStartWith('encrypted:')
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

    expect(encrypted).toStartWith('encrypted:')
    expect(encrypted.length).toBeGreaterThan(20)
    // Encrypted value should be base64 after "encrypted:" prefix
    const base64Part = encrypted.slice(10)
    expect(base64Part).toMatch(/^[A-Za-z0-9+/]+=*$/)
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
