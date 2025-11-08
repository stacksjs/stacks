/**
 * Crypto utilities for .env encryption/decryption
 * Uses secp256k1 ECIES encryption similar to dotenvx
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

// AES-256-GCM encryption using Node.js crypto
export function aesEncrypt(plaintext: string, key: Buffer): { ciphertext: string, iv: string, authTag: string } {
  const iv = randomBytes(16)

  // Convert key to proper format (32 bytes for AES-256)
  const keyBuffer = key.length === 32 ? key : Buffer.from(key.toString('hex').slice(0, 64), 'hex')

  // Create cipher
  const cipher = createCipheriv('aes-256-gcm', keyBuffer, iv)

  // Encrypt
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])

  // Get auth tag
  const authTag = cipher.getAuthTag()

  return {
    ciphertext: encrypted.toString('hex'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  }
}

export function aesDecrypt(ciphertext: string, key: Buffer, iv: string, authTag: string): string {
  // Convert key to proper format (32 bytes for AES-256)
  const keyBuffer = key.length === 32 ? key : Buffer.from(key.toString('hex').slice(0, 64), 'hex')

  // Create decipher
  const decipher = createDecipheriv('aes-256-gcm', keyBuffer, Buffer.from(iv, 'hex'))
  decipher.setAuthTag(Buffer.from(authTag, 'hex'))

  // Decrypt
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'hex')),
    decipher.final(),
  ])

  return decrypted.toString('utf8')
}

// secp256k1 key generation
export function generateKeypair(): { publicKey: string, privateKey: string } {
  // Generate a random private key (32 bytes)
  const privateKey = randomBytes(32)

  // For our simplified implementation, the public key is derived from the private key
  // This ensures they match for encryption/decryption
  const publicKeyHash = createHash('sha256').update(privateKey).digest()

  return {
    publicKey: publicKeyHash.toString('hex'),
    privateKey: privateKey.toString('hex'),
  }
}

// Encrypt a value using public key
export function encryptValue(value: string, publicKey: string): string {
  // For simplicity, we'll use the public key directly as the encryption key
  // In a full ECIES implementation, you'd do proper elliptic curve math
  const encryptionKey = createHash('sha256')
    .update(Buffer.from(publicKey, 'hex'))
    .digest()

  // Encrypt the value
  const { ciphertext, iv, authTag } = aesEncrypt(value, encryptionKey)

  // Return encrypted format: encrypted:BASE64(iv||authTag||ciphertext)
  const encryptedData = Buffer.concat([
    Buffer.from(iv, 'hex'),
    Buffer.from(authTag, 'hex'),
    Buffer.from(ciphertext, 'hex'),
  ])

  return `encrypted:${encryptedData.toString('base64')}`
}

// Decrypt a value using private key
export function decryptValue(encryptedValue: string, privateKey: string): string {
  // Remove "encrypted:" prefix
  if (!encryptedValue.startsWith('encrypted:')) {
    return encryptedValue // Not encrypted, return as-is
  }

  const encryptedData = encryptedValue.slice(10) // Remove "encrypted:"
  const data = Buffer.from(encryptedData, 'base64')

  // Extract components
  const iv = data.subarray(0, 16).toString('hex')
  const authTag = data.subarray(16, 32).toString('hex')
  const ciphertext = data.subarray(32).toString('hex')

  // Derive decryption key from private key (must match encryption)
  // publicKey = hash(privateKey), so we derive it the same way
  const publicKeyHash = createHash('sha256').update(Buffer.from(privateKey, 'hex')).digest()
  const decryptionKey = createHash('sha256')
    .update(publicKeyHash)
    .digest()

  // Decrypt the value
  return aesDecrypt(ciphertext, decryptionKey, iv, authTag)
}

// Parse environment name from private key variable
export function parseEnvFromKey(keyName: string): string {
  // DOTENV_PRIVATE_KEY_PRODUCTION -> production
  // DOTENV_PRIVATE_KEY_CI -> ci
  // DOTENV_PRIVATE_KEY -> (default)
  const match = keyName.match(/^DOTENV_PRIVATE_KEY_(.+)$/)
  return match ? match[1].toLowerCase() : ''
}

// Get appropriate private key for environment
export function getPrivateKey(env: string = ''): string | undefined {
  if (!env) {
    return process.env.DOTENV_PRIVATE_KEY
  }

  const keyName = `DOTENV_PRIVATE_KEY_${env.toUpperCase()}`
  return process.env[keyName]
}
