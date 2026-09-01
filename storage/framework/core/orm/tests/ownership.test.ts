import { describe, expect, it } from 'bun:test'
import { ownershipDeclaredUnscoped, teamOwnershipField, userOwnershipField } from '../src/auto-crud'
import { effectiveOwnershipConfig, parentOwnership, selfOwnership, teamAuthRequest } from '../src/ownership'

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

describe('parentOwnership', () => {
  it('carries the child foreign key as the field to compare', () => {
    expect(parentOwnership('Cart', 'cart_id').field).toBe('cart_id')
  })

  it('owns nothing when the parent model does not exist', async () => {
    // A typo in a model name must not widen access.
    const owned = await parentOwnership('NoSuchModel', 'nope_id').resolve({ id: 1 }, {})
    expect(owned).toEqual([])
  })

  it('owns nothing when the parent is itself unscoped', async () => {
    // `Product` declares `ownership: false`, so there is no set of parent rows
    // that belong to this caller in particular - and "no owner" must resolve to
    // owning nothing rather than to owning everything.
    const owned = await parentOwnership('Product', 'product_id').resolve({ id: 1 }, {})
    expect(owned).toEqual([])
  })

  it('owns nothing for an unauthenticated caller', async () => {
    const owned = await parentOwnership('Cart', 'cart_id').resolve(null, {})
    expect(owned).toEqual([])
  })
})

describe('effectiveOwnershipConfig', () => {
  it('treats `ownership: false` as unscoped, like saying nothing', () => {
    expect(effectiveOwnershipConfig({ ownership: false })).toBeNull()
    expect(effectiveOwnershipConfig({})).toBeNull()
  })

  it('lets an explicit config win over an owner column', () => {
    const explicit = { field: 'host_id', resolve: async () => 1 }
    const cfg = effectiveOwnershipConfig({ ownership: explicit, attributes: { team_id: {} } })
    expect(cfg).toBe(explicit)
  })

  it('auto-scopes a team column ahead of a user one', () => {
    // Both present is a tenant table that also records who created the row;
    // the tenant is the isolation boundary.
    const cfg = effectiveOwnershipConfig({ attributes: { team_id: {}, user_id: {} } })
    expect(cfg?.field).toBe('team_id')
  })

  it('auto-scopes a user column when there is no team', () => {
    expect(effectiveOwnershipConfig({ attributes: { user_id: {} } })?.field).toBe('user_id')
  })
})
