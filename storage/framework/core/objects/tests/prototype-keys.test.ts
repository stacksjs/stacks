import { afterEach, describe, expect, it } from 'bun:test'
import { deepMerge, invert, mapKeys, mapValues, omit, omitBy, pickBy, setPath } from '../src/index'

// What JSON.parse gives for a body with a "__proto__" key: an ordinary own key.
function jsonBody(): Record<string, unknown> {
  return JSON.parse('{"__proto__": {"isAdmin": true}, "name": "x", "password": "p"}')
}

// What the router's request input gives: the same key on a null-prototype object.
function requestInput(): Record<string, unknown> {
  const input = Object.create(null) as Record<string, unknown>
  input.__proto__ = { isAdmin: true }
  input.name = 'x'
  return input
}

afterEach(() => {
  delete (Object.prototype as Record<string, unknown>).isAdmin
})

describe('a "__proto__" key is data, never a prototype', () => {
  it('deepMerge leaves Object.prototype alone', () => {
    deepMerge({}, jsonBody())
    deepMerge({ settings: {} }, { settings: requestInput() })
    expect(({} as Record<string, unknown>).isAdmin).toBeUndefined()
  })

  it('deepMerge merges into a key the target only inherits as a new own value', () => {
    const merged = deepMerge({} as Record<string, unknown>, { constructor: { a: 1 } })
    expect(Object.hasOwn(merged, 'constructor')).toBe(true)
    expect(merged.constructor).toEqual({ a: 1 })
    expect(({}).constructor).toBe(Object)
  })

  it('omit, pickBy, omitBy, mapValues and mapKeys keep it as an own key', () => {
    for (const source of [jsonBody(), requestInput()]) {
      const results = [
        omit(source, ['password']),
        pickBy(source, () => true),
        omitBy(source, () => false),
        mapValues(source, value => value),
        mapKeys(source, key => key),
      ]
      for (const result of results) {
        expect((result as Record<string, unknown>).isAdmin).toBeUndefined()
        expect(Object.getPrototypeOf(result)).toBe(Object.prototype)
        expect(Object.keys(result)).toContain('__proto__')
      }
    }
  })

  it('invert keeps a "__proto__" value as a key', () => {
    const inverted = invert({ a: '__proto__', b: 'x' })
    expect(Object.keys(inverted).sort()).toEqual(['__proto__', 'x'])
    expect(Object.getPrototypeOf(inverted)).toBe(Object.prototype)
  })

  it('setPath writes a "__proto__" step as an own key', () => {
    const result = setPath({}, ['__proto__', 'isAdmin'], true) as Record<string, unknown>
    expect(result.isAdmin).toBeUndefined()
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype)
    expect(Object.hasOwn(result, '__proto__')).toBe(true)
    expect(setPath({ list: [1, 2] }, ['list', 1], 3)).toEqual({ list: [1, 3] })
  })
})
