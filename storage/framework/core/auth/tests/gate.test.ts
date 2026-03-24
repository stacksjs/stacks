import { afterEach, describe, expect, it } from 'bun:test'
import {
  AuthorizationException,
  AuthorizationResponse,
  Gate,
} from '../src/gate'

// Gate functions reference the global `User` type (typeof User).
// For testing we use plain objects as stand-ins since the gate callbacks
// accept `UserModel | null` and only forward them to our test callbacks.

type TestUser = Record<string, any> | null

afterEach(() => {
  Gate.flush()
})

// ─── AuthorizationResponse ──────────────────────────────────────────

describe('AuthorizationResponse', () => {
  it('allow() returns a response with isAllowed=true', () => {
    const res = AuthorizationResponse.allow()
    expect(res.isAllowed).toBe(true)
  })

  it('allow() can carry an optional message', () => {
    const res = AuthorizationResponse.allow('Granted by policy')
    expect(res.isAllowed).toBe(true)
    expect(res.message).toBe('Granted by policy')
  })

  it('deny() returns a response with isAllowed=false', () => {
    const res = AuthorizationResponse.deny()
    expect(res.isAllowed).toBe(false)
  })

  it('deny() uses a default message when none is provided', () => {
    const res = AuthorizationResponse.deny()
    expect(res.message).toBe('This action is unauthorized.')
  })

  it('deny() accepts a custom message and code', () => {
    const res = AuthorizationResponse.deny('Forbidden', 'FORBIDDEN')
    expect(res.isAllowed).toBe(false)
    expect(res.message).toBe('Forbidden')
    expect(res.code).toBe('FORBIDDEN')
  })

  it('allowed() returns true for an allow response', () => {
    const res = AuthorizationResponse.allow()
    expect(res.allowed()).toBe(true)
    expect(res.denied()).toBe(false)
  })

  it('denied() returns true for a deny response', () => {
    const res = AuthorizationResponse.deny()
    expect(res.denied()).toBe(true)
    expect(res.allowed()).toBe(false)
  })

  it('authorize() does not throw for an allowed response', () => {
    const res = AuthorizationResponse.allow()
    expect(() => res.authorize()).not.toThrow()
  })

  it('authorize() throws AuthorizationException for a denied response', () => {
    const res = AuthorizationResponse.deny('Nope', 'NOPE')
    expect(() => res.authorize()).toThrow(AuthorizationException)

    try {
      res.authorize()
    }
    catch (err: any) {
      expect(err).toBeInstanceOf(AuthorizationException)
      expect(err.message).toBe('Nope')
      expect(err.code).toBe('NOPE')
    }
  })
})

// ─── AuthorizationException ─────────────────────────────────────────

describe('AuthorizationException', () => {
  it('has a default message and status 403', () => {
    const err = new AuthorizationException()
    expect(err.message).toBe('This action is unauthorized.')
    expect(err.status).toBe(403)
    expect(err.name).toBe('AuthorizationException')
  })

  it('accepts a custom message and code', () => {
    const err = new AuthorizationException('Custom msg', 'CUSTOM')
    expect(err.message).toBe('Custom msg')
    expect(err.code).toBe('CUSTOM')
    expect(err.status).toBe(403)
  })
})

// ─── Gate.define / Gate.has / Gate.abilities ─────────────────────────

describe('Gate.define', () => {
  it('registers a gate that is discoverable via has()', () => {
    Gate.define('edit-post', () => true)
    expect(Gate.has('edit-post')).toBe(true)
  })

  it('lists registered abilities via abilities()', () => {
    Gate.define('create-post', () => true)
    Gate.define('delete-post', () => false)
    expect(Gate.abilities()).toContain('create-post')
    expect(Gate.abilities()).toContain('delete-post')
  })
})

// ─── Gate.allows / Gate.denies ──────────────────────────────────────

describe('Gate.allows / Gate.denies', () => {
  it('allows() returns true when the gate callback returns true', async () => {
    Gate.define('view-dashboard', () => true)
    const result = await Gate.allows('view-dashboard', null as TestUser)
    expect(result).toBe(true)
  })

  it('allows() returns false when the gate callback returns false', async () => {
    Gate.define('view-dashboard', () => false)
    const result = await Gate.allows('view-dashboard', null as TestUser)
    expect(result).toBe(false)
  })

  it('denies() is the inverse of allows()', async () => {
    Gate.define('view-dashboard', () => true)
    expect(await Gate.denies('view-dashboard', null as TestUser)).toBe(false)

    Gate.flush()
    Gate.define('view-dashboard', () => false)
    expect(await Gate.denies('view-dashboard', null as TestUser)).toBe(true)
  })

  it('passes user and extra arguments to the gate callback', async () => {
    const user = { id: 1, name: 'Alice' }
    Gate.define('update-post', (u: any, post: any) => u?.id === post?.ownerId)

    expect(await Gate.allows('update-post', user as any, { ownerId: 1 })).toBe(true)
    expect(await Gate.allows('update-post', user as any, { ownerId: 2 })).toBe(false)
  })

  it('handles async gate callbacks', async () => {
    Gate.define('async-gate', async () => {
      return true
    })
    expect(await Gate.allows('async-gate', null as TestUser)).toBe(true)
  })

  it('denies by default when no gate or policy is defined for the ability', async () => {
    // No gate defined for 'nonexistent'
    const result = await Gate.allows('nonexistent', null as TestUser)
    expect(result).toBe(false)
  })
})

// ─── Gate.authorize ─────────────────────────────────────────────────

describe('Gate.authorize', () => {
  it('returns AuthorizationResponse when the gate allows', async () => {
    Gate.define('do-thing', () => true)
    const res = await Gate.authorize('do-thing', null as TestUser)
    expect(res).toBeInstanceOf(AuthorizationResponse)
    expect(res.isAllowed).toBe(true)
  })

  it('throws AuthorizationException when the gate denies', async () => {
    Gate.define('do-thing', () => false)
    try {
      await Gate.authorize('do-thing', null as TestUser)
      // Should not reach here
      expect(true).toBe(false)
    }
    catch (err: any) {
      expect(err).toBeInstanceOf(AuthorizationException)
      expect(err.status).toBe(403)
    }
  })

  it('throws when no gate is defined for the ability', async () => {
    try {
      await Gate.authorize('undefined-ability', null as TestUser)
      expect(true).toBe(false)
    }
    catch (err: any) {
      expect(err).toBeInstanceOf(AuthorizationException)
      expect(err.message).toContain('No gate or policy defined')
    }
  })
})

// ─── Gate.can / Gate.cannot ─────────────────────────────────────────

describe('Gate.can / Gate.cannot', () => {
  it('can() is an alias for allows()', async () => {
    Gate.define('test-ability', () => true)
    expect(await Gate.can('test-ability', null as TestUser)).toBe(true)
  })

  it('cannot() is an alias for denies()', async () => {
    Gate.define('test-ability', () => true)
    expect(await Gate.cannot('test-ability', null as TestUser)).toBe(false)
  })
})

// ─── Gate.before callback ───────────────────────────────────────────

describe('Gate.before', () => {
  it('before callback returning true overrides the gate to allow', async () => {
    Gate.define('restricted', () => false)
    Gate.before(() => true)

    expect(await Gate.allows('restricted', null as TestUser)).toBe(true)
  })

  it('before callback returning false overrides the gate to deny', async () => {
    Gate.define('open-gate', () => true)
    Gate.before(() => false)

    expect(await Gate.allows('open-gate', null as TestUser)).toBe(false)
  })

  it('before callback returning null falls through to the gate', async () => {
    Gate.define('normal-gate', () => true)
    Gate.before(() => null)

    expect(await Gate.allows('normal-gate', null as TestUser)).toBe(true)
  })

  it('supports a super-admin pattern via before callback', async () => {
    Gate.define('manage-users', (user: any) => user?.role === 'admin')
    Gate.before((user: any) => {
      if (user?.isSuperAdmin) return true
      return null
    })

    const superAdmin = { isSuperAdmin: true, role: 'user' }
    const regularUser = { isSuperAdmin: false, role: 'user' }
    const admin = { isSuperAdmin: false, role: 'admin' }

    expect(await Gate.allows('manage-users', superAdmin as any)).toBe(true)
    expect(await Gate.allows('manage-users', regularUser as any)).toBe(false)
    expect(await Gate.allows('manage-users', admin as any)).toBe(true)
  })
})

// ─── Gate.inspect ───────────────────────────────────────────────────

describe('Gate.inspect', () => {
  it('returns AuthorizationResponse with allow when gate passes', async () => {
    Gate.define('viewable', () => true)
    const res = await Gate.inspect('viewable', null as TestUser)
    expect(res).toBeInstanceOf(AuthorizationResponse)
    expect(res.isAllowed).toBe(true)
  })

  it('returns AuthorizationResponse with deny and message for undefined gate', async () => {
    const res = await Gate.inspect('missing', null as TestUser)
    expect(res.isAllowed).toBe(false)
    expect(res.message).toContain('No gate or policy defined')
  })

  it('returns an AuthorizationResponse directly when gate returns one', async () => {
    Gate.define('detailed', () => AuthorizationResponse.deny('Custom reason', 'CUSTOM'))
    const res = await Gate.inspect('detailed', null as TestUser)
    expect(res.isAllowed).toBe(false)
    expect(res.message).toBe('Custom reason')
    expect(res.code).toBe('CUSTOM')
  })
})

// ─── Gate.flush ─────────────────────────────────────────────────────

describe('Gate.flush', () => {
  it('clears all gates and callbacks', async () => {
    Gate.define('temp', () => true)
    Gate.before(() => true)
    expect(Gate.has('temp')).toBe(true)

    Gate.flush()

    expect(Gate.has('temp')).toBe(false)
    expect(Gate.abilities()).toEqual([])
    // After flush, an undefined gate should deny
    expect(await Gate.allows('temp', null as TestUser)).toBe(false)
  })
})
