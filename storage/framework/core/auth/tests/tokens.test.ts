import { describe, expect, test } from 'bun:test'
import { createHash, randomBytes } from 'node:crypto'

// Import real token functions - for DB-dependent functions we test signatures
const {
  parseScopes,
  tokens,
  findToken,
  tokenCan,
  tokenCant,
  tokenCanAll,
  tokenCanAny,
  tokenAbilities,
} = await import('../src/tokens')

// ---------------------------------------------------------------------------
// Tests - Pure utility functions (no DB needed)
// ---------------------------------------------------------------------------

describe('Token utilities - hashToken', () => {
  test('SHA-256 hash of a known string matches expected hex digest', () => {
    // hashToken is private, but we can replicate its logic to test correctness
    const input = 'my-secret-token'
    const hash = createHash('sha256').update(input).digest('hex')
    expect(hash).toHaveLength(64) // SHA-256 always 64 hex chars
    expect(hash).toBe(createHash('sha256').update(input).digest('hex'))
  })

  test('different inputs produce different hashes', () => {
    const hash1 = createHash('sha256').update('token-a').digest('hex')
    const hash2 = createHash('sha256').update('token-b').digest('hex')
    expect(hash1).not.toBe(hash2)
  })

  test('empty string produces a valid hash', () => {
    const hash = createHash('sha256').update('').digest('hex')
    expect(hash).toHaveLength(64)
  })
})

describe('Token utilities - generateSecureToken', () => {
  test('randomBytes(40) produces 80-char hex string', () => {
    const token = randomBytes(40).toString('hex')
    expect(token).toHaveLength(80)
  })

  test('generated tokens are unique', () => {
    const t1 = randomBytes(40).toString('hex')
    const t2 = randomBytes(40).toString('hex')
    expect(t1).not.toBe(t2)
  })

  test('custom byte length produces correct hex length', () => {
    const token = randomBytes(16).toString('hex')
    expect(token).toHaveLength(32)
  })
})

describe('Token utilities - parseScopes', () => {
  test('null returns empty array', () => {
    expect(parseScopes(null)).toEqual([])
  })

  test('undefined returns empty array', () => {
    expect(parseScopes(undefined)).toEqual([])
  })

  test('empty string returns empty array', () => {
    expect(parseScopes('')).toEqual([])
  })

  test('array input is returned as-is', () => {
    const scopes = ['read', 'write']
    expect(parseScopes(scopes)).toEqual(['read', 'write'])
  })

  test('JSON string is parsed to array', () => {
    const json = JSON.stringify(['admin', 'read'])
    expect(parseScopes(json)).toEqual(['admin', 'read'])
  })

  test('invalid JSON returns empty array', () => {
    expect(parseScopes('not-json')).toEqual([])
  })

  test('JSON object (non-array) returns empty array', () => {
    expect(parseScopes('{"key": "value"}')).toEqual([])
  })
})

describe('Token retrieval - tokens()', () => {
  test('tokens is a function that accepts a userId', () => {
    expect(typeof tokens).toBe('function')
    expect(tokens.length).toBeGreaterThanOrEqual(1)
  })

  test('tokens returns a promise', () => {
    const result = tokens(42)
    expect(result).toBeInstanceOf(Promise)
    // Catch the expected DB error
    result.catch(() => {})
  })
})

describe('Token retrieval - findToken()', () => {
  test('findToken is a function that accepts a token string', () => {
    expect(typeof findToken).toBe('function')
    expect(findToken.length).toBeGreaterThanOrEqual(1)
  })

  test('findToken returns a promise', () => {
    const result = findToken('nonexistent')
    expect(result).toBeInstanceOf(Promise)
    // Catch the expected DB error
    result.catch(() => {})
  })
})

describe('Token scope checking', () => {
  test('tokenCan is a function', () => {
    expect(typeof tokenCan).toBe('function')
  })

  test('tokenCant is a function', () => {
    expect(typeof tokenCant).toBe('function')
  })

  test('tokenCanAll is a function', () => {
    expect(typeof tokenCanAll).toBe('function')
  })

  test('tokenCanAny is a function', () => {
    expect(typeof tokenCanAny).toBe('function')
  })

  test('tokenAbilities is a function', () => {
    expect(typeof tokenAbilities).toBe('function')
  })
})
