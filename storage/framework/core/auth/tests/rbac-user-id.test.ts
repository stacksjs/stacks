import type { RbacStore } from '../src/rbac'
// stacksjs/stacks#2562 — RBAC must accept the id shape the database returns.
//
// `getUserId()` required `typeof id === 'number'`. On Postgres `users.id` is
// BIGSERIAL and `bun:sql` returns it as a STRING, so every RBAC call carrying a
// user loaded from the database threw and RBAC was unusable on that dialect.
//
// The guard's original reason (stacksjs/stacks#1860 M-6) still holds and is
// kept: a nullish id must never collapse into a shared cache slot where every
// such user reads the same roles. That argument is about nonsense ids, not
// about "125".
import { beforeEach, describe, expect, test } from 'bun:test'
import { hasRole, setRbacStore } from '../src/rbac'

/** Records which user id the store was asked about. */
let askedFor: number[] = []

function createStore(): RbacStore {
  return {
    async getUserRoles(userId: number) {
      askedFor.push(userId)
      return [{ id: 1, name: 'admin', guard_name: 'web' }]
    },
    async getUserPermissions() { return [] },
  } as unknown as RbacStore
}

beforeEach(() => {
  askedFor = []
  setRbacStore(createStore())
})

describe('accepted id shapes', () => {
  test('a number, as SQLite returns', async () => {
    expect(await hasRole({ id: 125 } as never, 'admin')).toBe(true)
    expect(askedFor).toEqual([125])
  })

  test('a numeric string, as Postgres BIGSERIAL returns', async () => {
    // The whole bug. Red before the fix.
    expect(await hasRole({ id: '125' } as never, 'admin')).toBe(true)
    expect(askedFor).toEqual([125])
  })

  test('a bigint', async () => {
    expect(await hasRole({ id: 125n } as never, 'admin')).toBe(true)
    expect(askedFor).toEqual([125])
  })

  test('a bare number argument still works', async () => {
    expect(await hasRole(125 as never, 'admin')).toBe(true)
  })

  test('string and number ids reach the same cache slot', async () => {
    // They name one user, so they must not be cached separately - and the
    // store must be asked with a number either way.
    await hasRole({ id: 125 } as never, 'admin')
    await hasRole({ id: '125' } as never, 'admin')

    expect(askedFor.every(id => id === 125)).toBe(true)
    expect(askedFor.every(id => typeof id === 'number')).toBe(true)
  })
})

describe('rejected id shapes', () => {
  // Each of these would otherwise share one cache slot, or authorise against
  // the wrong user entirely.
  test.each([
    ['undefined', undefined],
    ['null', null],
    ['an empty string', ''],
    ['a non-numeric string', 'abc'],
    ['zero', 0],
    ['a negative number', -1],
    ['a fractional number', 1.5],
  ])('rejects %s', async (_label, id) => {
    await expect(hasRole({ id } as never, 'admin')).rejects.toThrow(/positive number/)
  })

  test('rejects a boolean, which Number() would turn into user 1', async () => {
    // `Number(true) === 1`. Coercing blindly would authorise against whoever
    // user 1 happens to be, which on most installs is an administrator.
    await expect(hasRole({ id: true } as never, 'admin')).rejects.toThrow(/positive number/)
  })

  test('rejects a single-element array, which Number() would unwrap', async () => {
    await expect(hasRole({ id: [125] } as never, 'admin')).rejects.toThrow(/positive number/)
  })

  test('rejects an id beyond the safe integer range', async () => {
    // Two distinct BIGSERIAL ids can round to the same double up here, which
    // is #1860 M-6's shared-cache-slot failure arriving by another route.
    await expect(hasRole({ id: '9007199254740993' } as never, 'admin'))
      .rejects.toThrow(/safe integer range/)
  })
})
