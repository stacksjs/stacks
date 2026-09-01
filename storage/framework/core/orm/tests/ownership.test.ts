import { describe, expect, it } from 'bun:test'
import { ownershipDeclaredUnscoped, teamOwnershipField, userOwnershipField } from '../src/auto-crud'
import { selfOwnership, teamAuthRequest } from '../src/ownership'

/**
 * Row scoping for generated mutating routes (stacksjs/stacks#2375).
 *
 * `security.api.rowScoping` defaults to `'deny'`, so these three predicates
 * decide whether a model gets `store` / `update` / `destroy` at all.
 */

describe('userOwnershipField', () => {
  it('detects a declared user_id in either spelling', () => {
    expect(userOwnershipField({ attributes: { user_id: {} } })).toBe('user_id')
    expect(userOwnershipField({ attributes: { userId: {} } })).toBe('user_id')
  })

  it('detects the column a belongsTo relation creates', () => {
    // Model-driven migration creates the FK, so a model should not have to
    // repeat it as a synthetic attribute just to activate isolation.
    expect(userOwnershipField({ belongsTo: ['User'] })).toBe('user_id')
  })

  it('is null for a model with no user relation', () => {
    expect(userOwnershipField({ attributes: { name: {} }, belongsTo: ['Team'] })).toBeNull()
    expect(userOwnershipField(null)).toBeNull()
  })

  it('does not confuse a team relation for a user one', () => {
    expect(userOwnershipField({ belongsTo: ['Team'] })).toBeNull()
    expect(teamOwnershipField({ belongsTo: ['User'] })).toBeNull()
  })
})

describe('ownershipDeclaredUnscoped', () => {
  it('tells a declared `ownership: false` from saying nothing', () => {
    // The whole point of the flag: "considered, and nothing owns these rows"
    // has to be distinguishable from "nobody thought about it", or denying by
    // default punishes every legitimate catalog table too.
    expect(ownershipDeclaredUnscoped({ ownership: false })).toBe(true)
    expect(ownershipDeclaredUnscoped({})).toBe(false)
    expect(ownershipDeclaredUnscoped(null)).toBe(false)
  })

  it('is not satisfied by a real ownership config', () => {
    expect(ownershipDeclaredUnscoped({ ownership: { field: 'user_id' } })).toBe(false)
  })
})

describe('selfOwnership', () => {
  it('resolves to the authenticated user id, and nothing without one', async () => {
    const cfg = selfOwnership()
    expect(cfg.field).toBe('id')
    expect(await cfg.resolve({ id: 7 })).toBe(7)
    // Owning nothing is the safe answer for an unauthenticated caller.
    expect(await cfg.resolve(null)).toBeNull()
    expect(await cfg.resolve({})).toBeNull()
  })
})

describe('teamAuthRequest', () => {
  it('surfaces the bearer token from the Authorization header', () => {
    const req = { headers: new Headers({ authorization: 'Bearer abc123' }) }
    expect(teamAuthRequest(req).bearerToken()).toBe('abc123')
  })

  it('has no token when the header is absent or not a bearer', () => {
    expect(teamAuthRequest({ headers: new Headers() }).bearerToken()).toBeNull()
    expect(teamAuthRequest({ headers: new Headers({ authorization: 'Basic xyz' }) }).bearerToken()).toBeNull()
  })

  it('reads one cookie out of the header without matching a prefix', () => {
    const req = { headers: new Headers({ cookie: 'other=1; session=wanted; session_extra=no' }) }
    const cookies = teamAuthRequest(req).cookies
    expect(cookies.get('session')).toBe('wanted')
    expect(cookies.get('missing')).toBeNull()
  })

  it('survives a request with no headers at all', () => {
    const adapted = teamAuthRequest({})
    expect(adapted.bearerToken()).toBeNull()
    expect(adapted.cookies.get('session')).toBeNull()
  })
})
