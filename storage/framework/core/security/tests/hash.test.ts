import { beforeAll, describe, expect, test } from 'bun:test'
import {
  detectAlgorithm,
  info,
  needsRehash,
  make,
  check,
  bcryptEncode,
  argon2Encode,
  base64Verify,
  md5Encode,
  hashMake,
  hashCheck,
  hashNeedsRehash,
  hashInfo,
  hashDetectAlgorithm,
  makeHash,
  verifyHash,
  base64Encode,
} from '../src/hash'

// Pre-generated hashes for synchronous tests
let bcryptHash: string
let argon2idHash: string

beforeAll(async () => {
  bcryptHash = await bcryptEncode('test-password')
  argon2idHash = await argon2Encode('test-password')
})

// ---------------------------------------------------------------------------
// detectAlgorithm
// ---------------------------------------------------------------------------
describe('detectAlgorithm', () => {
  test('detects $2a$ bcrypt hash', () => {
    expect(detectAlgorithm('$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012'))
      .toBe('bcrypt')
  })

  test('detects $2b$ bcrypt hash', () => {
    expect(detectAlgorithm('$2b$12$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012'))
      .toBe('bcrypt')
  })

  test('detects $2y$ bcrypt hash', () => {
    expect(detectAlgorithm('$2y$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012'))
      .toBe('bcrypt')
  })

  test('detects argon2id hash', () => {
    expect(detectAlgorithm('$argon2id$v=19$m=65536,t=2,p=1$somesalt$somehash'))
      .toBe('argon2id')
  })

  test('detects argon2i hash', () => {
    expect(detectAlgorithm('$argon2i$v=19$m=65536,t=2,p=1$somesalt$somehash'))
      .toBe('argon2i')
  })

  test('detects argon2d hash', () => {
    expect(detectAlgorithm('$argon2d$v=19$m=65536,t=2,p=1$somesalt$somehash'))
      .toBe('argon2d')
  })

  test('returns unknown for unrecognized string', () => {
    expect(detectAlgorithm('random-string-not-a-hash')).toBe('unknown')
  })

  test('returns unknown for empty string', () => {
    expect(detectAlgorithm('')).toBe('unknown')
  })

  test('returns unknown for null', () => {
    expect(detectAlgorithm(null as unknown as string)).toBe('unknown')
  })

  test('returns unknown for undefined', () => {
    expect(detectAlgorithm(undefined as unknown as string)).toBe('unknown')
  })

  test('returns unknown for number input', () => {
    expect(detectAlgorithm(12345 as unknown as string)).toBe('unknown')
  })
})

// ---------------------------------------------------------------------------
// info
// ---------------------------------------------------------------------------
describe('info', () => {
  test('extracts rounds from bcrypt hash', () => {
    const result = info('$2b$12$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012')
    expect(result.algorithm).toBe('bcrypt')
    expect(result.options.rounds).toBe(12)
  })

  test('extracts rounds from $2a$ bcrypt hash', () => {
    const result = info('$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012')
    expect(result.algorithm).toBe('bcrypt')
    expect(result.options.rounds).toBe(10)
  })

  test('extracts argon2id parameters', () => {
    const result = info('$argon2id$v=19$m=65536,t=2,p=1$c29tZXNhbHQ$c29tZWhhc2g')
    expect(result.algorithm).toBe('argon2id')
    expect(result.options.version).toBe(19)
    expect(result.options.memory).toBe(65536)
    expect(result.options.rounds).toBe(2) // time cost is stored as rounds
    expect(result.options.parallelism).toBe(1)
  })

  test('extracts argon2i parameters', () => {
    const result = info('$argon2i$v=19$m=32768,t=3,p=4$c29tZXNhbHQ$c29tZWhhc2g')
    expect(result.algorithm).toBe('argon2i')
    expect(result.options.version).toBe(19)
    expect(result.options.memory).toBe(32768)
    expect(result.options.rounds).toBe(3)
    expect(result.options.parallelism).toBe(4)
  })

  test('returns unknown algorithm and empty options for unrecognized hash', () => {
    const result = info('not-a-valid-hash')
    expect(result.algorithm).toBe('unknown')
    expect(result.options).toEqual({})
  })

  test('works with real bcrypt hash', async () => {
    const hash = await bcryptEncode('test', 10)
    const result = info(hash)
    expect(result.algorithm).toBe('bcrypt')
    expect(result.options.rounds).toBe(10)
  })

  test('works with real argon2id hash', async () => {
    const hash = await argon2Encode('test', { memory: 65536, time: 2 })
    const result = info(hash)
    expect(result.algorithm).toBe('argon2id')
    expect(result.options.memory).toBe(65536)
    expect(result.options.rounds).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// needsRehash
// ---------------------------------------------------------------------------
describe('needsRehash', () => {
  test('returns false when bcrypt hash matches configured rounds', () => {
    // The real config fallback uses bcrypt with rounds: 12
    const hash = '$2b$12$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012'
    expect(needsRehash(hash)).toBe(false)
  })

  test('returns true when algorithm differs from configured', () => {
    // Config driver is bcrypt, but hash is argon2id
    const hash = '$argon2id$v=19$m=65536,t=2,p=1$c29tZXNhbHQ$c29tZWhhc2g'
    expect(needsRehash(hash)).toBe(true)
  })

  test('returns true when bcrypt rounds differ from configured', () => {
    // Config driver is bcrypt rounds=12 (default), but hash has rounds=8
    const hash = '$2b$08$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012'
    expect(needsRehash(hash)).toBe(true)
  })

  test('returns false when bcrypt hash matches custom options', () => {
    const hash = '$2b$14$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012'
    expect(needsRehash(hash, { algorithm: 'bcrypt', rounds: 14 })).toBe(false)
  })

  test('returns true when bcrypt hash does not match custom rounds', () => {
    const hash = '$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012'
    expect(needsRehash(hash, { algorithm: 'bcrypt', rounds: 14 })).toBe(true)
  })

  test('returns false when argon2id hash matches custom options', () => {
    const hash = '$argon2id$v=19$m=32768,t=3,p=1$c29tZXNhbHQ$c29tZWhhc2g'
    expect(needsRehash(hash, { algorithm: 'argon2id', memory: 32768, time: 3 })).toBe(false)
  })

  test('returns true when argon2id memory differs from custom options', () => {
    const hash = '$argon2id$v=19$m=65536,t=2,p=1$c29tZXNhbHQ$c29tZWhhc2g'
    expect(needsRehash(hash, { algorithm: 'argon2id', memory: 32768, time: 2 })).toBe(true)
  })

  test('returns true for unknown hash algorithm', () => {
    expect(needsRehash('not-a-hash')).toBe(true)
  })

  test('normalizes argon2 to argon2id for comparison', () => {
    const hash = '$argon2id$v=19$m=65536,t=2,p=1$c29tZXNhbHQ$c29tZWhhc2g'
    expect(needsRehash(hash, { algorithm: 'argon2', memory: 65536, time: 2 })).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// make
// ---------------------------------------------------------------------------
describe('make', () => {
  test('creates bcrypt hash with explicit algorithm', async () => {
    const hash = await make('password123', { algorithm: 'bcrypt' })
    expect(hash.startsWith('$2')).toBe(true)
  })

  test('creates argon2id hash with explicit algorithm', async () => {
    const hash = await make('password123', { algorithm: 'argon2id' })
    expect(hash.startsWith('$argon2id$')).toBe(true)
  })

  test('argon2 alias produces argon2id hash', async () => {
    const hash = await make('password123', { algorithm: 'argon2' })
    expect(hash.startsWith('$argon2id$')).toBe(true)
  })

  test('creates argon2i hash', async () => {
    const hash = await make('password123', { algorithm: 'argon2i' })
    expect(hash.startsWith('$argon2i$')).toBe(true)
  })

  test('creates argon2d hash', async () => {
    const hash = await make('password123', { algorithm: 'argon2d' })
    expect(hash.startsWith('$argon2d$')).toBe(true)
  })

  test('throws for unsupported algorithm', async () => {
    await expect(make('password123', { algorithm: 'sha256' as any })).rejects.toThrow(
      'Unsupported hashing algorithm',
    )
  })

  test('uses default algorithm from config when no options given', async () => {
    // Config driver is bcrypt (default)
    const hash = await make('password123')
    expect(hash.startsWith('$2')).toBe(true)
  })

  test('respects custom rounds for bcrypt', async () => {
    const hash = await make('password123', { algorithm: 'bcrypt', rounds: 4 })
    const result = info(hash)
    expect(result.options.rounds).toBe(4)
  })

  test('respects custom memory/time for argon2', async () => {
    const hash = await make('password123', { algorithm: 'argon2id', memory: 32768, time: 3 })
    const result = info(hash)
    expect(result.options.memory).toBe(32768)
    expect(result.options.rounds).toBe(3) // time stored as rounds
  })

  test('different passwords produce different hashes', async () => {
    const hash1 = await make('password1', { algorithm: 'bcrypt' })
    const hash2 = await make('password2', { algorithm: 'bcrypt' })
    expect(hash1).not.toBe(hash2)
  })

  test('same password produces different hashes (random salt)', async () => {
    const hash1 = await make('same-password', { algorithm: 'bcrypt' })
    const hash2 = await make('same-password', { algorithm: 'bcrypt' })
    expect(hash1).not.toBe(hash2)
  })
})

// ---------------------------------------------------------------------------
// check
// ---------------------------------------------------------------------------
describe('check', () => {
  test('returns true for correct bcrypt password', async () => {
    const hash = await bcryptEncode('my-secret')
    expect(await check('my-secret', hash)).toBe(true)
  })

  test('returns false for wrong bcrypt password', async () => {
    const hash = await bcryptEncode('my-secret')
    expect(await check('wrong-password', hash)).toBe(false)
  })

  test('returns true for correct argon2id password', async () => {
    const hash = await argon2Encode('my-secret')
    expect(await check('my-secret', hash)).toBe(true)
  })

  test('returns false for wrong argon2id password', async () => {
    const hash = await argon2Encode('my-secret')
    expect(await check('wrong-password', hash)).toBe(false)
  })

  test('returns false for empty value', async () => {
    expect(await check('', bcryptHash)).toBe(false)
  })

  test('returns false for empty hash', async () => {
    expect(await check('my-secret', '')).toBe(false)
  })

  test('returns false for both empty', async () => {
    expect(await check('', '')).toBe(false)
  })

  test('handles unknown hash format gracefully', async () => {
    const result = await check('password', 'not-a-valid-hash')
    expect(result).toBe(false)
  })

  test('verifies password made with make()', async () => {
    const hash = await make('check-this-password', { algorithm: 'bcrypt' })
    expect(await check('check-this-password', hash)).toBe(true)
    expect(await check('not-this-password', hash)).toBe(false)
  })

  test('verifies argon2 password made with make()', async () => {
    const hash = await make('check-argon2', { algorithm: 'argon2id' })
    expect(await check('check-argon2', hash)).toBe(true)
    expect(await check('nope', hash)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// bcryptEncode
// ---------------------------------------------------------------------------
describe('bcryptEncode', () => {
  test('produces a valid bcrypt hash', async () => {
    const hash = await bcryptEncode('test-password')
    expect(hash.startsWith('$2')).toBe(true)
    expect(hash.length).toBeGreaterThan(50)
  })

  test('uses custom rounds', async () => {
    const hash = await bcryptEncode('test-password', 4)
    const result = info(hash)
    expect(result.options.rounds).toBe(4)
  })

  test('uses config rounds when none specified', async () => {
    const hash = await bcryptEncode('test-password')
    const result = info(hash)
    // Real config fallback uses rounds: 12, should be a valid number either way
    expect(result.options.rounds).toBeGreaterThanOrEqual(4)
  })

  test('different inputs produce different hashes', async () => {
    const hash1 = await bcryptEncode('alpha')
    const hash2 = await bcryptEncode('beta')
    expect(hash1).not.toBe(hash2)
  })
})

// ---------------------------------------------------------------------------
// argon2Encode
// ---------------------------------------------------------------------------
describe('argon2Encode', () => {
  test('produces a valid argon2id hash by default', async () => {
    const hash = await argon2Encode('test-password')
    expect(hash.startsWith('$argon2id$')).toBe(true)
  })

  test('supports argon2i type', async () => {
    const hash = await argon2Encode('test-password', { type: 'argon2i' })
    expect(hash.startsWith('$argon2i$')).toBe(true)
  })

  test('supports argon2d type', async () => {
    const hash = await argon2Encode('test-password', { type: 'argon2d' })
    expect(hash.startsWith('$argon2d$')).toBe(true)
  })

  test('uses custom memory and time', async () => {
    const hash = await argon2Encode('test-password', { memory: 32768, time: 3 })
    const result = info(hash)
    expect(result.options.memory).toBe(32768)
    expect(result.options.rounds).toBe(3)
  })

  test('different inputs produce different hashes', async () => {
    const hash1 = await argon2Encode('alpha')
    const hash2 = await argon2Encode('beta')
    expect(hash1).not.toBe(hash2)
  })
})

// ---------------------------------------------------------------------------
// base64Verify
// ---------------------------------------------------------------------------
describe('base64Verify', () => {
  test('returns true for matching password', () => {
    const encoded = base64Encode('hello-world')
    expect(base64Verify('hello-world', encoded)).toBe(true)
  })

  test('returns false for non-matching password', () => {
    const encoded = base64Encode('hello-world')
    expect(base64Verify('wrong', encoded)).toBe(false)
  })

  test('returns false for different length strings', () => {
    const encoded = base64Encode('short')
    expect(base64Verify('a-much-longer-string-here', encoded)).toBe(false)
  })

  test('handles empty string', () => {
    const encoded = base64Encode('')
    expect(base64Verify('', encoded)).toBe(true)
  })

  test('is case sensitive', () => {
    const encoded = base64Encode('Hello')
    expect(base64Verify('hello', encoded)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// md5Encode
// ---------------------------------------------------------------------------
describe('md5Encode', () => {
  test('produces consistent output for same input', () => {
    const hash1 = md5Encode('test')
    const hash2 = md5Encode('test')
    expect(hash1).toBe(hash2)
  })

  test('produces different output for different input', () => {
    const hash1 = md5Encode('alpha')
    const hash2 = md5Encode('beta')
    expect(hash1).not.toBe(hash2)
  })

  test('returns a hex string', () => {
    const hash = md5Encode('hello')
    expect(hash).toMatch(/^[a-f0-9]+$/i)
  })

  test('produces 32-character hex hash', () => {
    const hash = md5Encode('hello')
    expect(hash.length).toBe(32)
  })

  test('handles empty string', () => {
    const hash = md5Encode('')
    expect(typeof hash).toBe('string')
    expect(hash.length).toBe(32)
  })
})

// ---------------------------------------------------------------------------
// Legacy aliases
// ---------------------------------------------------------------------------
describe('legacy aliases', () => {
  test('hashMake is the same function as make', () => {
    expect(hashMake).toBe(make)
  })

  test('hashCheck is the same function as check', () => {
    expect(hashCheck).toBe(check)
  })

  test('hashNeedsRehash is the same function as needsRehash', () => {
    expect(hashNeedsRehash).toBe(needsRehash)
  })

  test('hashInfo is the same function as info', () => {
    expect(hashInfo).toBe(info)
  })

  test('hashDetectAlgorithm is the same function as detectAlgorithm', () => {
    expect(hashDetectAlgorithm).toBe(detectAlgorithm)
  })

  test('makeHash is the same function as make', () => {
    expect(makeHash).toBe(make)
  })

  test('verifyHash is the same function as check', () => {
    expect(verifyHash).toBe(check)
  })

  test('hashMake produces a valid hash', async () => {
    const hash = await hashMake('legacy-test', { algorithm: 'bcrypt' })
    expect(hash.startsWith('$2')).toBe(true)
  })

  test('hashCheck verifies correctly', async () => {
    const hash = await hashMake('legacy-verify')
    expect(await hashCheck('legacy-verify', hash)).toBe(true)
    expect(await hashCheck('wrong', hash)).toBe(false)
  })
})
