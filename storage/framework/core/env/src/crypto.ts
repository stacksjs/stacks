/**
 * Versioned authenticated environment encryption.
 *
 * New values use ephemeral-static X25519, HKDF-SHA-256, and AES-256-GCM as
 * proposed by stacksjs/rfcs#6. The unversioned reader exists only to migrate
 * ciphertext created by the pre-RFC hash-derived construction.
 */

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createPrivateKey,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
} from 'node:crypto'

const PUBLIC_KEY_PREFIX = 'x25519-public:'
const PRIVATE_KEY_PREFIX = 'x25519-private:'
const ENVELOPE_PREFIX = 'encrypted:v2:'
const LEGACY_PREFIX = 'encrypted:'
const HKDF_INFO = Buffer.from('stacks-env:v2', 'utf8')
const DECRYPTION_ERROR = 'Environment decryption failed: authentication or format error'

interface EnvelopeV2 {
  v: 2
  epk: string
  salt: string
  nonce: string
  ciphertext: string
  tag: string
}

function encryptionKey(key: Buffer): Buffer {
  if (key.length === 32) return key
  return createHash('sha256').update(key).digest()
}

export function aesEncrypt(plaintext: string, key: Buffer): { ciphertext: string, iv: string, authTag: string } {
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(key), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return { ciphertext: encrypted.toString('hex'), iv: iv.toString('hex'), authTag: cipher.getAuthTag().toString('hex') }
}

export function aesDecrypt(ciphertext: string, key: Buffer, iv: string, authTag: string): string {
  try {
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(key), Buffer.from(iv, 'hex'))
    decipher.setAuthTag(Buffer.from(authTag, 'hex'))
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'hex')), decipher.final()]).toString('utf8')
  }
  catch {
    throw new Error('Decryption failed: authentication or format error')
  }
}

function encode(data: Buffer): string {
  return data.toString('base64url')
}

function decode(value: unknown, label: string, expectedLength?: number): Buffer {
  if (typeof value !== 'string' || (value.length > 0 && !/^[A-Za-z0-9_-]+$/.test(value)))
    throw new Error(`${label} is not canonical base64url`)
  const decoded = Buffer.from(value, 'base64url')
  if (encode(decoded) !== value) throw new Error(`${label} is not canonical base64url`)
  if (expectedLength !== undefined && decoded.length !== expectedLength) throw new Error(`${label} has an invalid length`)
  return decoded
}

function parsePublicKey(value: string) {
  if (!value.startsWith(PUBLIC_KEY_PREFIX))
    throw new Error('Legacy or invalid public key. Run buddy env:rotate before creating new ciphertext.')
  const key = createPublicKey({ key: decode(value.slice(PUBLIC_KEY_PREFIX.length), 'public key'), format: 'der', type: 'spki' })
  if (key.asymmetricKeyType !== 'x25519') throw new Error('Public key is not X25519')
  return key
}

function parsePrivateKey(value: string) {
  if (!value.startsWith(PRIVATE_KEY_PREFIX)) throw new Error('Private key is not a version 2 X25519 key')
  const key = createPrivateKey({ key: decode(value.slice(PRIVATE_KEY_PREFIX.length), 'private key'), format: 'der', type: 'pkcs8' })
  if (key.asymmetricKeyType !== 'x25519') throw new Error('Private key is not X25519')
  return key
}

function aad(envelope: Pick<EnvelopeV2, 'epk' | 'salt' | 'nonce'>): Buffer {
  return Buffer.from(`stacks-env:v2;${envelope.epk};${envelope.salt};${envelope.nonce}`, 'utf8')
}

export function generateKeypair(): { publicKey: string, privateKey: string } {
  const { publicKey, privateKey } = generateKeyPairSync('x25519')
  const publicDer = publicKey.export({ format: 'der', type: 'spki' })
  const privateDer = privateKey.export({ format: 'der', type: 'pkcs8' })
  return {
    publicKey: `${PUBLIC_KEY_PREFIX}${encode(publicDer)}`,
    privateKey: `${PRIVATE_KEY_PREFIX}${encode(privateDer)}`,
  }
}

export function encryptValue(value: string, recipientPublicKey: string): string {
  const recipient = parsePublicKey(recipientPublicKey)
  const ephemeral = generateKeyPairSync('x25519')
  const epk = encode(ephemeral.publicKey.export({ format: 'der', type: 'spki' }))
  const salt = randomBytes(16)
  const nonce = randomBytes(12)
  const shared = diffieHellman({ privateKey: ephemeral.privateKey, publicKey: recipient })
  const key = Buffer.from(hkdfSync('sha256', shared, salt, HKDF_INFO, 32))
  const metadata = { epk, salt: encode(salt), nonce: encode(nonce) }
  try {
    const cipher = createCipheriv('aes-256-gcm', key, nonce)
    cipher.setAAD(aad(metadata))
    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
    const envelope: EnvelopeV2 = {
      v: 2,
      ...metadata,
      ciphertext: encode(ciphertext),
      tag: encode(cipher.getAuthTag()),
    }
    return `${ENVELOPE_PREFIX}${encode(Buffer.from(JSON.stringify(envelope), 'utf8'))}`
  }
  finally {
    shared.fill(0)
    key.fill(0)
  }
}

function parseEnvelope(value: string): EnvelopeV2 {
  const serialized = decode(value.slice(ENVELOPE_PREFIX.length), 'envelope').toString('utf8')
  const parsed = JSON.parse(serialized) as Record<string, unknown>
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('envelope is not an object')
  const keys = Object.keys(parsed).sort()
  const expected = ['ciphertext', 'epk', 'nonce', 'salt', 'tag', 'v']
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) throw new Error('envelope fields are invalid')
  if (parsed.v !== 2) throw new Error('envelope version is unsupported')
  for (const field of ['epk', 'salt', 'nonce', 'ciphertext', 'tag']) {
    if (typeof parsed[field] !== 'string') throw new Error(`${field} is invalid`)
  }
  return parsed as unknown as EnvelopeV2
}

function decryptV2(encryptedValue: string, recipientPrivateKey: string): string {
  try {
    const envelope = parseEnvelope(encryptedValue)
    const recipient = parsePrivateKey(recipientPrivateKey)
    const ephemeral = createPublicKey({ key: decode(envelope.epk, 'ephemeral public key'), format: 'der', type: 'spki' })
    if (ephemeral.asymmetricKeyType !== 'x25519') throw new Error('ephemeral key is not X25519')
    const salt = decode(envelope.salt, 'salt', 16)
    const nonce = decode(envelope.nonce, 'nonce', 12)
    const ciphertext = decode(envelope.ciphertext, 'ciphertext')
    const tag = decode(envelope.tag, 'tag', 16)
    const shared = diffieHellman({ privateKey: recipient, publicKey: ephemeral })
    const key = Buffer.from(hkdfSync('sha256', shared, salt, HKDF_INFO, 32))
    try {
      const decipher = createDecipheriv('aes-256-gcm', key, nonce)
      decipher.setAAD(aad(envelope))
      decipher.setAuthTag(tag)
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
    }
    finally {
      shared.fill(0)
      key.fill(0)
    }
  }
  catch {
    throw new Error(DECRYPTION_ERROR)
  }
}

function decryptLegacy(encryptedValue: string, privateKey: string): string {
  try {
    if (!/^[0-9a-f]{64}$/.test(privateKey)) throw new Error('invalid legacy private key')
    const data = Buffer.from(encryptedValue.slice(LEGACY_PREFIX.length), 'base64')
    if (data.length < 32) throw new Error('invalid legacy payload')
    const publicKeyHash = createHash('sha256').update(Buffer.from(privateKey, 'hex')).digest()
    const key = createHash('sha256').update(publicKeyHash).digest()
    return aesDecrypt(data.subarray(32).toString('hex'), key, data.subarray(0, 16).toString('hex'), data.subarray(16, 32).toString('hex'))
  }
  catch {
    throw new Error(DECRYPTION_ERROR)
  }
}

export function isLegacyEncryptedValue(value: string): boolean {
  return value.startsWith(LEGACY_PREFIX) && !value.startsWith(ENVELOPE_PREFIX)
}

export function decryptValue(encryptedValue: string, privateKey: string): string {
  if (!encryptedValue.startsWith(LEGACY_PREFIX)) return encryptedValue
  return encryptedValue.startsWith(ENVELOPE_PREFIX)
    ? decryptV2(encryptedValue, privateKey)
    : decryptLegacy(encryptedValue, privateKey)
}

export function migrateEncryptedValue(encryptedValue: string, oldPrivateKey: string, newPublicKey: string): string {
  return encryptValue(decryptValue(encryptedValue, oldPrivateKey), newPublicKey)
}

export function parseEnvFromKey(keyName: string): string {
  const match = keyName.match(/^DOTENV_PRIVATE_KEY_(.+)$/)
  return match && match[1] ? match[1].toLowerCase() : ''
}

export function getPrivateKey(env: string = ''): string | undefined {
  return env ? process.env[`DOTENV_PRIVATE_KEY_${env.toUpperCase()}`] : process.env.DOTENV_PRIVATE_KEY
}
