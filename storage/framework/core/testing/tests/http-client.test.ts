import { describe, expect, it } from 'bun:test'
import { assertRequestOptions, queryString } from '../src/feature'

describe('queryString', () => {
  it('returns an empty string when there is nothing to append', () => {
    expect(queryString(undefined)).toBe('')
    expect(queryString({})).toBe('')
  })

  it('renders scalars', () => {
    expect(queryString({ page: 1, sort: 'name', active: true })).toBe('?page=1&sort=name&active=true')
  })

  it('drops undefined and null rather than sending them as strings', () => {
    // An optional filter can be passed straight through without the caller
    // building the object conditionally.
    expect(queryString({ page: 1, cursor: undefined, after: null })).toBe('?page=1')
  })

  it('repeats the key for an array', () => {
    expect(queryString({ tag: ['a', 'b'] })).toBe('?tag=a&tag=b')
  })

  it('escapes values', () => {
    expect(queryString({ q: 'a b&c' })).toBe('?q=a+b%26c')
  })

  it('keeps an empty string, which is a real filter value', () => {
    expect(queryString({ q: '' })).toBe('?q=')
  })
})

describe('assertRequestOptions', () => {
  it('accepts every documented option', () => {
    expect(() => assertRequestOptions(
      { headers: {}, query: {}, body: {}, formData: {}, actingAs: { id: 1 } },
      'POST',
      '/api/users',
    )).not.toThrow()
  })

  it('accepts an empty object', () => {
    expect(() => assertRequestOptions({}, 'GET', '/api/users')).not.toThrow()
  })

  it('rejects a bare body, which would otherwise send an empty request', () => {
    expect(() => assertRequestOptions(
      { name: 'Jane' } as Record<string, unknown>,
      'POST',
      '/api/users',
    )).toThrow(/unknown option\(s\) 'name'/)
  })

  it('names the wrapper the caller should have used', () => {
    expect(() => assertRequestOptions(
      { name: 'Jane' } as Record<string, unknown>,
      'POST',
      '/api/users',
    )).toThrow(/\{ body: \{ name: … \} \}/)
  })

  it('lists every unknown key, not just the first', () => {
    expect(() => assertRequestOptions(
      { name: 'Jane', email: 'a@b.com' } as Record<string, unknown>,
      'POST',
      '/api/users',
    )).toThrow(/'name', 'email'/)
  })
})
