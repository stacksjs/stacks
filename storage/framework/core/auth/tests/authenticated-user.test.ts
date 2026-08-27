import { describe, expect, it } from 'bun:test'
import { authenticatedUser } from '../src/middleware'

/**
 * What every authorization middleware in the scaffold agrees "the user" is.
 *
 * The cases that matter are the near-misses: a lazily-resolving macro, and an
 * object that is truthy but is not a user. Both used to get past this
 * function and fail further down — the macro as a callable with none of the
 * fields the caller read, the id-less object inside RBAC, which validates its
 * input and throws a TypeError. An authorization middleware answering 500
 * tells a signed-out visitor and a signed-in admin exactly the same
 * unhelpful thing.
 */

describe('authenticatedUser', () => {
  it('returns the user stamped on the request by the auth middleware', async () => {
    const user = { id: 7, email: 'a@b.c' }
    expect(await authenticatedUser({ _authenticatedUser: user })).toBe(user)
  })

  it('resolves the lazy `user` macro rather than returning the function', async () => {
    const user = { id: 3 }
    const resolved = await authenticatedUser({ user: async () => user })
    expect(resolved).toBe(user)
    expect(typeof resolved).not.toBe('function')
  })

  it('accepts a plain object an upstream middleware stamped on `user`', async () => {
    const user = { id: 11 }
    expect(await authenticatedUser({ user })).toBe(user)
  })

  it('rejects an object with no id, so the caller answers 401 and not 500', async () => {
    expect(await authenticatedUser({ _authenticatedUser: {} })).toBeUndefined()
    expect(await authenticatedUser({ user: { name: 'nobody' } })).toBeUndefined()
    expect(await authenticatedUser({ user: async () => ({ name: 'nobody' }) })).toBeUndefined()
  })

  it('rejects an id that is not a usable key', async () => {
    expect(await authenticatedUser({ _authenticatedUser: { id: 0 } })).toBeUndefined()
    expect(await authenticatedUser({ _authenticatedUser: { id: -1 } })).toBeUndefined()
    expect(await authenticatedUser({ _authenticatedUser: { id: Number.NaN } })).toBeUndefined()
    expect(await authenticatedUser({ _authenticatedUser: { id: '   ' } })).toBeUndefined()
  })

  it('accepts a string id, which a custom user provider may issue', async () => {
    const user = { id: 'usr_01H8' }
    expect(await authenticatedUser({ _authenticatedUser: user })).toBe(user)
  })

  it('returns undefined when nobody is signed in', async () => {
    expect(await authenticatedUser({})).toBeUndefined()
    expect(await authenticatedUser(null)).toBeUndefined()
    expect(await authenticatedUser({ user: null })).toBeUndefined()
  })
})
