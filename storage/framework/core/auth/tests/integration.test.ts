import { describe, expect, test, beforeEach } from 'bun:test'
import { RateLimiter } from '../src/rate-limiter'
import {
  AuthorizationException,
  AuthorizationResponse,
  Gate,
  define,
  allows,
  denies,
  can,
  cannot,
  any,
  all,
  none,
  authorize,
  inspect,
  has,
  abilities,
  flush,
  before,
} from '../src/gate'
import { parseScopes } from '../src/tokens'

// ---------------------------------------------------------------------------
// RateLimiter
// ---------------------------------------------------------------------------
describe('RateLimiter', () => {
  beforeEach(() => {
    // Reset state between tests
    RateLimiter.resetAttempts('test@example.com')
    RateLimiter.resetAttempts('other@example.com')
  })

  test('new email is not rate limited', () => {
    expect(RateLimiter.isRateLimited('test@example.com')).toBe(false)
  })

  test('recording fewer than 5 failed attempts does not trigger lockout', () => {
    for (let i = 0; i < 4; i++) {
      RateLimiter.recordFailedAttempt('test@example.com')
    }
    expect(RateLimiter.isRateLimited('test@example.com')).toBe(false)
  })

  test('recording 5 failed attempts triggers lockout', () => {
    for (let i = 0; i < 5; i++) {
      RateLimiter.recordFailedAttempt('test@example.com')
    }
    expect(RateLimiter.isRateLimited('test@example.com')).toBe(true)
  })

  test('resetAttempts clears lockout', () => {
    for (let i = 0; i < 5; i++) {
      RateLimiter.recordFailedAttempt('test@example.com')
    }
    expect(RateLimiter.isRateLimited('test@example.com')).toBe(true)
    RateLimiter.resetAttempts('test@example.com')
    expect(RateLimiter.isRateLimited('test@example.com')).toBe(false)
  })

  test('email lookup is case insensitive', () => {
    for (let i = 0; i < 5; i++) {
      RateLimiter.recordFailedAttempt('Test@Example.COM')
    }
    expect(RateLimiter.isRateLimited('test@example.com')).toBe(true)
  })

  test('different emails are tracked independently', () => {
    for (let i = 0; i < 5; i++) {
      RateLimiter.recordFailedAttempt('test@example.com')
    }
    expect(RateLimiter.isRateLimited('other@example.com')).toBe(false)
  })

  test('validateAttempt throws HttpError when rate limited', () => {
    for (let i = 0; i < 5; i++) {
      RateLimiter.recordFailedAttempt('test@example.com')
    }
    expect(() => RateLimiter.validateAttempt('test@example.com')).toThrow()
  })

  test('validateAttempt does not throw when not rate limited', () => {
    expect(() => RateLimiter.validateAttempt('test@example.com')).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// AuthorizationResponse
// ---------------------------------------------------------------------------
describe('AuthorizationResponse', () => {
  test('allow() creates an allowed response', () => {
    const response = AuthorizationResponse.allow('ok')
    expect(response.isAllowed).toBe(true)
    expect(response.allowed()).toBe(true)
    expect(response.denied()).toBe(false)
    expect(response.message).toBe('ok')
  })

  test('deny() creates a denied response', () => {
    const response = AuthorizationResponse.deny('forbidden', 'DENIED')
    expect(response.isAllowed).toBe(false)
    expect(response.allowed()).toBe(false)
    expect(response.denied()).toBe(true)
    expect(response.message).toBe('forbidden')
    expect(response.code).toBe('DENIED')
  })

  test('authorize() throws for denied response', () => {
    const response = AuthorizationResponse.deny('nope')
    expect(() => response.authorize()).toThrow('nope')
  })

  test('authorize() does not throw for allowed response', () => {
    const response = AuthorizationResponse.allow()
    expect(() => response.authorize()).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// AuthorizationException
// ---------------------------------------------------------------------------
describe('AuthorizationException', () => {
  test('has correct name and message', () => {
    const err = new AuthorizationException('no access', 'CODE_1', 403)
    expect(err.name).toBe('AuthorizationException')
    expect(err.message).toBe('no access')
    expect(err.code).toBe('CODE_1')
    expect(err.status).toBe(403)
  })

  test('uses default message', () => {
    const err = new AuthorizationException()
    expect(err.message).toBe('This action is unauthorized.')
  })
})

// ---------------------------------------------------------------------------
// Gate (define, allows, denies, authorize, etc.)
// ---------------------------------------------------------------------------
describe('Gate', () => {
  beforeEach(() => {
    flush()
  })

  test('define and check a simple gate with allows', async () => {
    define('edit-settings', (user: any) => user?.isAdmin === true)
    const result = await allows('edit-settings', { isAdmin: true } as any)
    expect(result).toBe(true)
  })

  test('denies returns true when gate denies access', async () => {
    define('edit-settings', (user: any) => user?.isAdmin === true)
    const result = await denies('edit-settings', { isAdmin: false } as any)
    expect(result).toBe(true)
  })

  test('can is alias for allows', async () => {
    define('view-dashboard', () => true)
    const result = await can('view-dashboard', null)
    expect(result).toBe(true)
  })

  test('cannot is alias for denies', async () => {
    define('view-dashboard', () => false)
    const result = await cannot('view-dashboard', null)
    expect(result).toBe(true)
  })

  test('undefined gate denies by default', async () => {
    const result = await allows('nonexistent', null)
    expect(result).toBe(false)
  })

  test('has() checks if gate is defined', () => {
    define('my-gate', () => true)
    expect(has('my-gate')).toBe(true)
    expect(has('other-gate')).toBe(false)
  })

  test('abilities() returns all defined gate names', () => {
    define('gate-a', () => true)
    define('gate-b', () => false)
    const list = abilities()
    expect(list).toContain('gate-a')
    expect(list).toContain('gate-b')
  })

  test('flush() clears all gates', () => {
    define('temp-gate', () => true)
    flush()
    expect(has('temp-gate')).toBe(false)
    expect(abilities().length).toBe(0)
  })

  test('authorize throws for denied ability', async () => {
    define('admin-only', () => false)
    try {
      await authorize('admin-only', null)
      expect(true).toBe(false) // should not reach
    }
    catch (e) {
      expect(e).toBeInstanceOf(AuthorizationException)
    }
  })

  test('authorize returns response for allowed ability', async () => {
    define('read-posts', () => true)
    const response = await authorize('read-posts', null)
    expect(response.isAllowed).toBe(true)
  })

  test('inspect returns AuthorizationResponse', async () => {
    define('inspect-gate', () => true)
    const result = await inspect('inspect-gate', null)
    expect(result).toBeInstanceOf(AuthorizationResponse)
    expect(result.isAllowed).toBe(true)
  })

  test('any() returns true if any ability passes', async () => {
    define('read', () => true)
    define('write', () => false)
    const result = await any(['read', 'write'], null)
    expect(result).toBe(true)
  })

  test('any() returns false if all abilities fail', async () => {
    define('a', () => false)
    define('b', () => false)
    const result = await any(['a', 'b'], null)
    expect(result).toBe(false)
  })

  test('all() returns true if all abilities pass', async () => {
    define('x', () => true)
    define('y', () => true)
    const result = await all(['x', 'y'], null)
    expect(result).toBe(true)
  })

  test('all() returns false if any ability fails', async () => {
    define('x', () => true)
    define('y', () => false)
    const result = await all(['x', 'y'], null)
    expect(result).toBe(false)
  })

  test('none() returns true if no ability passes', async () => {
    define('a', () => false)
    define('b', () => false)
    const result = await none(['a', 'b'], null)
    expect(result).toBe(true)
  })

  test('before callback can override gate to allow', async () => {
    before((_user: any, _ability: string) => true)
    define('restricted', () => false)
    const result = await allows('restricted', null)
    expect(result).toBe(true)
  })

  test('gate receives extra arguments', async () => {
    define('own-post', (user: any, post: any) => user?.id === post?.authorId)
    const result = await allows('own-post', { id: 1 } as any, { authorId: 1 })
    expect(result).toBe(true)
  })

  test('Gate facade has all methods', () => {
    expect(typeof Gate.define).toBe('function')
    expect(typeof Gate.allows).toBe('function')
    expect(typeof Gate.denies).toBe('function')
    expect(typeof Gate.can).toBe('function')
    expect(typeof Gate.cannot).toBe('function')
    expect(typeof Gate.authorize).toBe('function')
    expect(typeof Gate.flush).toBe('function')
    expect(typeof Gate.has).toBe('function')
    expect(typeof Gate.abilities).toBe('function')
  })
})

// ---------------------------------------------------------------------------
// parseScopes (from tokens.ts - pure function, no DB needed)
// ---------------------------------------------------------------------------
describe('parseScopes', () => {
  test('parses JSON string array', () => {
    const result = parseScopes('["read","write"]')
    expect(result).toEqual(['read', 'write'])
  })

  test('returns empty array for null', () => {
    expect(parseScopes(null)).toEqual([])
  })

  test('returns empty array for undefined', () => {
    expect(parseScopes(undefined)).toEqual([])
  })

  test('returns array as-is when already an array', () => {
    const scopes = ['admin', 'user']
    expect(parseScopes(scopes)).toEqual(['admin', 'user'])
  })

  test('returns empty array for invalid JSON', () => {
    expect(parseScopes('not-json')).toEqual([])
  })

  test('returns empty array for empty string', () => {
    expect(parseScopes('')).toEqual([])
  })

  test('returns empty array for JSON object (not array)', () => {
    expect(parseScopes('{"key":"value"}')).toEqual([])
  })
})
