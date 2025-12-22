import { base64Decode, base64Encode, hashPassword, md5, verifyPassword } from 'ts-security-crypto'

/**
 * Lazy-load hashing config to avoid circular dependency issues
 */
function getHashingConfig(): {
  driver?: string
  bcrypt?: { rounds?: number }
  argon2?: { memory?: number, time?: number }
} {
  try {
    // Dynamic import to avoid circular dependency
    // eslint-disable-next-line ts/no-require-imports
    const { hashing } = require('@stacksjs/config')
    return hashing || {}
  }
  catch {
    // Fallback to Laravel-like defaults if config not available
    return {
      driver: 'bcrypt',
      bcrypt: { rounds: 12 },
      argon2: { memory: 65536, time: 2 },
    }
  }
}

/**
 * Supported hashing algorithms
 */
export type HashAlgorithm = 'bcrypt' | 'argon2' | 'argon2id' | 'argon2i' | 'argon2d'

/**
 * Options for creating a hash
 */
export interface HashMakeOptions {
  /** The hashing algorithm to use */
  algorithm?: HashAlgorithm
  /** Bcrypt cost factor (4-31) */
  rounds?: number
  /** Argon2 memory cost in kibibytes */
  memory?: number
  /** Argon2 time cost (iterations) */
  time?: number
}

/**
 * Information about a hashed value
 */
export interface HashInfo {
  /** The algorithm used */
  algorithm: HashAlgorithm | 'unknown'
  /** Algorithm-specific options extracted from the hash */
  options: {
    /** Bcrypt cost or Argon2 time cost */
    rounds?: number
    /** Argon2 memory cost */
    memory?: number
    /** Argon2 parallelism */
    parallelism?: number
    /** Argon2 version */
    version?: number
  }
}

/**
 * Detect the hashing algorithm from a hash string
 * Laravel-compatible hash detection
 */
export function detectAlgorithm(hash: string): HashAlgorithm | 'unknown' {
  if (!hash || typeof hash !== 'string') {
    return 'unknown'
  }

  // Bcrypt hashes start with $2a$, $2b$, or $2y$
  if (hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$')) {
    return 'bcrypt'
  }

  // Argon2 hashes start with $argon2id$, $argon2i$, or $argon2d$
  if (hash.startsWith('$argon2id$')) {
    return 'argon2id'
  }
  if (hash.startsWith('$argon2i$')) {
    return 'argon2i'
  }
  if (hash.startsWith('$argon2d$')) {
    return 'argon2d'
  }

  return 'unknown'
}

/**
 * Extract information from a hash string
 * Similar to Laravel's Hash::info()
 */
export function info(hash: string): HashInfo {
  const algorithm = detectAlgorithm(hash)
  const options: HashInfo['options'] = {}

  if (algorithm === 'bcrypt') {
    // Bcrypt format: $2a$XX$... where XX is the cost
    const match = hash.match(/^\$2[aby]\$(\d{2})\$/)
    if (match) {
      options.rounds = Number.parseInt(match[1], 10)
    }
  }
  else if (algorithm === 'argon2id' || algorithm === 'argon2i' || algorithm === 'argon2d') {
    // Argon2 format: $argon2id$v=XX$m=XXXX,t=XX,p=XX$...
    const versionMatch = hash.match(/v=(\d+)/)
    const memoryMatch = hash.match(/m=(\d+)/)
    const timeMatch = hash.match(/t=(\d+)/)
    const parallelismMatch = hash.match(/p=(\d+)/)

    if (versionMatch) options.version = Number.parseInt(versionMatch[1], 10)
    if (memoryMatch) options.memory = Number.parseInt(memoryMatch[1], 10)
    if (timeMatch) options.rounds = Number.parseInt(timeMatch[1], 10)
    if (parallelismMatch) options.parallelism = Number.parseInt(parallelismMatch[1], 10)
  }

  return { algorithm, options }
}

/**
 * Check if a hash needs to be rehashed
 * Similar to Laravel's Hash::needsRehash()
 *
 * Returns true if:
 * - The algorithm doesn't match the configured default
 * - The cost/rounds don't match the configured values
 */
export function needsRehash(hash: string, options?: HashMakeOptions): boolean {
  const hashInfo = info(hash)
  const config = getHashingConfig()
  const configuredDriver = options?.algorithm || config.driver || 'argon2id'

  // Normalize algorithm names for comparison
  const normalizeAlgorithm = (alg: string): string => {
    if (alg === 'argon2') return 'argon2id'
    return alg
  }

  const currentAlgorithm = normalizeAlgorithm(hashInfo.algorithm)
  const targetAlgorithm = normalizeAlgorithm(configuredDriver)

  // Different algorithm means rehash needed
  if (currentAlgorithm !== targetAlgorithm) {
    return true
  }

  // Check cost/rounds for bcrypt
  if (currentAlgorithm === 'bcrypt') {
    const configuredRounds = options?.rounds || config.bcrypt?.rounds || 10
    if (hashInfo.options.rounds !== configuredRounds) {
      return true
    }
  }

  // Check parameters for argon2
  if (currentAlgorithm.startsWith('argon2')) {
    const configuredMemory = options?.memory || config.argon2?.memory || 65536
    const configuredTime = options?.time || config.argon2?.time || 1

    if (hashInfo.options.memory !== configuredMemory || hashInfo.options.rounds !== configuredTime) {
      return true
    }
  }

  return false
}

/**
 * Hash a value using the configured or specified algorithm
 * Similar to Laravel's Hash::make()
 */
export async function make(value: string, options?: HashMakeOptions): Promise<string> {
  const config = getHashingConfig()
  const algorithm = options?.algorithm || config.driver || 'argon2id'

  if (algorithm === 'bcrypt') {
    return await bcryptEncode(value, options?.rounds)
  }

  if (algorithm === 'argon2' || algorithm === 'argon2id' || algorithm === 'argon2i' || algorithm === 'argon2d') {
    const type = algorithm === 'argon2' ? 'argon2id' : algorithm
    return await argon2Encode(value, {
      type,
      memory: options?.memory,
      time: options?.time,
    })
  }

  throw new Error(`Unsupported hashing algorithm: ${algorithm}`)
}

/**
 * Verify a value against a hash
 * Similar to Laravel's Hash::check()
 *
 * Auto-detects the algorithm from the hash format
 */
export async function check(value: string, hash: string): Promise<boolean> {
  if (!value || !hash) {
    return false
  }

  const algorithm = detectAlgorithm(hash)

  if (algorithm === 'unknown') {
    // Try to verify anyway - the underlying library might handle it
    try {
      return await verifyPassword(value, hash)
    }
    catch {
      return false
    }
  }

  return await verifyPassword(value, hash)
}

/**
 * Encode a password using bcrypt
 * Laravel uses $2y$ prefix, rounds 10-12 by default
 */
export async function bcryptEncode(password: string, rounds?: number): Promise<string> {
  const config = getHashingConfig()
  const cost = rounds || config.bcrypt?.rounds || 12

  return await hashPassword(password, {
    algorithm: 'bcrypt',
    cost,
  })
}

/**
 * Encode a password using Argon2
 */
export async function argon2Encode(
  password: string,
  options?: {
    type?: 'argon2id' | 'argon2i' | 'argon2d'
    memory?: number
    time?: number
  },
): Promise<string> {
  const config = getHashingConfig()
  const type = options?.type || 'argon2id'
  const memory = options?.memory || config.argon2?.memory || 65536
  const time = options?.time || config.argon2?.time || 1

  return await hashPassword(password, {
    algorithm: type,
    memoryCost: memory,
    timeCost: time,
  })
}

/**
 * Verify a password against an Argon2 hash
 * @deprecated Use check() instead which auto-detects the algorithm
 */
export async function argon2Verify(password: string, hash: string): Promise<boolean> {
  return await verifyPassword(password, hash)
}

/**
 * Verify a password against a bcrypt hash
 * @deprecated Use check() instead which auto-detects the algorithm
 */
export async function bcryptVerify(password: string, hash: string): Promise<boolean> {
  return await verifyPassword(password, hash)
}

/**
 * Verify a password against a base64 encoded string
 * Note: base64 is NOT a secure password hash - only for legacy support
 */
export function base64Verify(password: string, hash: string): boolean {
  return base64Decode(hash) === password
}

/**
 * Create an MD5 hash (NOT secure for passwords)
 */
export function md5Encode(password: string): string {
  return md5(password)
}

// Function-based exports (preferred API)
export {
  make as hashMake,
  check as hashCheck,
  needsRehash as hashNeedsRehash,
  info as hashInfo,
  detectAlgorithm as hashDetectAlgorithm,
}

// Legacy exports for backwards compatibility
export { make as makeHash, check as verifyHash, base64Encode }
