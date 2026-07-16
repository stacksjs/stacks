import { describe, expect, it } from 'bun:test'
import { InvalidFeatureScopeError } from '../src/errors'
import { featureScopeKey } from '../src/scope'

describe('featureScopeKey', () => {
  it('uses a stable global scope', () => {
    expect(featureScopeKey()).toBe('global')
    expect(featureScopeKey(null)).toBe('global')
  })

  it('keeps primitive types distinct', () => {
    expect(featureScopeKey('1')).toBe('string:1')
    expect(featureScopeKey(1)).toBe('number:1')
    expect(featureScopeKey(1n)).toBe('bigint:1')
    expect(featureScopeKey(true)).toBe('boolean:true')
  })

  it('uses model identity by convention', () => {
    class User {
      id = 42
    }
    expect(featureScopeKey(new User())).toBe('model:User:42')
    expect(featureScopeKey({ id: 42, featureFlagType: 'Account' })).toBe('model:Account:42')
    expect(featureScopeKey({ id: 42, _definition: { name: 'User' } })).toBe('model:User:42')
  })

  it('supports an explicit scope provider', () => {
    const team = {
      featureFlagType: () => 'Team',
      featureFlagScope: () => 'acme',
    }
    expect(featureScopeKey(team)).toBe('model:Team:acme')
  })

  it('canonicalizes plain objects independent of key order', () => {
    const first = featureScopeKey({ tenant: 'acme', region: 'us', nested: { b: 2, a: 1 } })
    const second = featureScopeKey({ nested: { a: 1, b: 2 }, region: 'us', tenant: 'acme' })
    expect(first).toBe(second)
  })

  it('hashes oversized keys deterministically for SQL storage', () => {
    const first = featureScopeKey(`tenant:${'🚀'.repeat(300)}`)
    const second = featureScopeKey(`tenant:${'🚀'.repeat(300)}`)
    expect(first).toBe(second)
    expect(first).toMatch(/^sha256:[a-f0-9]{64}$/)
  })

  it('rejects ambiguous or unstable scopes', () => {
    expect(() => featureScopeKey(Number.NaN)).toThrow(InvalidFeatureScopeError)
    expect(() => featureScopeKey(Symbol('scope'))).toThrow(InvalidFeatureScopeError)
    expect(() => featureScopeKey({ featureFlagScope: '' })).toThrow(InvalidFeatureScopeError)
    expect(() => featureScopeKey(new Map([['tenant', 'acme']]))).toThrow(/plain objects/)

    const circular: Record<string, unknown> = {}
    circular.self = circular
    expect(() => featureScopeKey(circular)).toThrow(/circular/i)
  })
})
