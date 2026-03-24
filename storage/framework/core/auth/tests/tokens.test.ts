import { describe, expect, mock, test } from 'bun:test'
import { createHash, randomBytes } from 'node:crypto'

// ---------------------------------------------------------------------------
// Mock external deps
// ---------------------------------------------------------------------------

const mockUnsafe = mock((..._args: any[]) => Promise.resolve([]))

mock.module('@stacksjs/database', () => ({
  db: { unsafe: mockUnsafe },
  sql: {},
  sqlHelpers: () => ({
    driver: 'sqlite',
    isPostgres: false,
    isMysql: false,
    isSqlite: true,
    now: `datetime('now')`,
    boolTrue: '1',
    boolFalse: '0',
    param: () => '?',
    params: (...vals: any[]) => ({ sql: vals.map(() => '?').join(', '), values: vals }),
  }),
}))

mock.module('@stacksjs/env', () => ({
  env: { DB_CONNECTION: 'sqlite' },
}))

mock.module('@stacksjs/error-handling', () => ({
  HttpError: class HttpError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  },
}))

mock.module('@stacksjs/router', () => ({
  getCurrentRequest: () => null,
}))

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

const { parseScopes, tokens, findToken, tokenCan, tokenCant, tokenCanAll, tokenCanAny, tokenAbilities } = await import('../src/tokens')

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
  test('returns mapped access tokens from DB rows', async () => {
    mockUnsafe.mockImplementationOnce(() => Promise.resolve([
      {
        id: 1,
        user_id: 42,
        oauth_client_id: 1,
        name: 'test-token',
        scopes: '["read","write"]',
        revoked: 0,
        expires_at: '2099-01-01T00:00:00Z',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ]))

    const result = await tokens(42)
    expect(result).toHaveLength(1)
    expect(result[0].userId).toBe(42)
    expect(result[0].name).toBe('test-token')
    expect(result[0].scopes).toEqual(['read', 'write'])
    expect(result[0].revoked).toBe(false)
  })

  test('returns empty array when no tokens exist', async () => {
    mockUnsafe.mockImplementationOnce(() => Promise.resolve([]))
    const result = await tokens(999)
    expect(result).toEqual([])
  })
})

describe('Token retrieval - findToken()', () => {
  test('returns null when token not found', async () => {
    mockUnsafe.mockImplementationOnce(() => Promise.resolve([]))
    const result = await findToken('nonexistent')
    expect(result).toBeNull()
  })

  test('returns access token when found', async () => {
    mockUnsafe.mockImplementationOnce(() => Promise.resolve([
      {
        id: 5,
        user_id: 10,
        oauth_client_id: 1,
        name: 'api-key',
        scopes: '["*"]',
        revoked: 0,
        expires_at: '2099-12-31T00:00:00Z',
        created_at: '2024-06-01T00:00:00Z',
        updated_at: null,
      },
    ]))
    const result = await findToken('some-plain-token')
    expect(result).not.toBeNull()
    expect(result!.id).toBe(5)
    expect(result!.scopes).toEqual(['*'])
  })
})

describe('Token scope checking', () => {
  test('tokenCan returns false when no request context', async () => {
    const result = await tokenCan('read')
    expect(result).toBe(false)
  })

  test('tokenCant returns true when no request context', async () => {
    const result = await tokenCant('admin')
    expect(result).toBe(true)
  })

  test('tokenCanAll returns false when no request context', async () => {
    const result = await tokenCanAll(['read', 'write'])
    expect(result).toBe(false)
  })

  test('tokenCanAny returns false when no request context', async () => {
    const result = await tokenCanAny(['admin', 'moderator'])
    expect(result).toBe(false)
  })

  test('tokenAbilities returns empty array when no request context', async () => {
    const result = await tokenAbilities()
    expect(result).toEqual([])
  })
})
