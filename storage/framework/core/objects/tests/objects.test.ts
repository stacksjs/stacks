import { describe, expect, it } from 'bun:test'
import {
  clearUndefined,
  deepMerge,
  hasOwnProperty,
  isKeyOf,
  objectEntries,
  objectKeys,
  objectMap,
  objectPick,
} from '../src/index'

describe('objectMap', () => {
  it('should transform values', () => {
    const result = objectMap({ a: 1, b: 2 }, (k, v) => [k, v * 2])
    expect(result).toEqual({ a: 2, b: 4 })
  })

  it('should transform keys', () => {
    const result = objectMap({ a: 1, b: 2 }, (k, v) => [k.toUpperCase(), v])
    expect(result).toEqual({ A: 1, B: 2 })
  })

  it('should swap key/value', () => {
    const result = objectMap({ a: 1, b: 2 } as Record<string, number>, (k, v) => [String(v), k])
    expect(result).toEqual({ 1: 'a', 2: 'b' })
  })

  it('should filter entries when returning undefined', () => {
    const result = objectMap({ a: 1, b: 2, c: 3 }, (k, v) => k === 'b' ? undefined : [k, v])
    expect(result).toEqual({ a: 1, c: 3 })
  })

  it('should handle empty object', () => {
    const result = objectMap({} as Record<string, number>, (k, v) => [k, v])
    expect(result).toEqual({})
  })
})

describe('isKeyOf', () => {
  it('should return true for existing key', () => {
    expect(isKeyOf({ a: 1, b: 2 }, 'a')).toBe(true)
  })

  it('should return false for non-existing key', () => {
    expect(isKeyOf({ a: 1, b: 2 }, 'c')).toBe(false)
  })

  it('should work with symbol keys', () => {
    const sym = Symbol('test')
    expect(isKeyOf({ [sym]: 1 }, sym)).toBe(true)
  })
})

describe('objectKeys', () => {
  it('should return typed keys', () => {
    const keys = objectKeys({ a: 1, b: 2, c: 3 })
    expect(keys).toEqual(['a', 'b', 'c'])
  })

  it('should return empty array for empty object', () => {
    expect(objectKeys({})).toEqual([])
  })
})

describe('objectEntries', () => {
  it('should return typed entries', () => {
    const entries = objectEntries({ a: 1, b: 2 })
    expect(entries).toEqual([['a', 1], ['b', 2]])
  })

  it('should return empty array for empty object', () => {
    expect(objectEntries({})).toEqual([])
  })
})

describe('deepMerge', () => {
  it('should merge flat objects', () => {
    const result = deepMerge({ a: 1 }, { b: 2 })
    expect(result).toEqual({ a: 1, b: 2 })
  })

  it('should override primitive values', () => {
    const result = deepMerge({ a: 1 }, { a: 2 })
    expect(result).toEqual({ a: 2 })
  })

  it('should deep merge nested objects', () => {
    const result = deepMerge(
      { a: { x: 1, y: 2 } },
      { a: { y: 3, z: 4 } },
    )
    expect(result).toEqual({ a: { x: 1, y: 3, z: 4 } })
  })

  it('should handle deeply nested objects', () => {
    const result = deepMerge(
      { a: { b: { c: 1 } } },
      { a: { b: { d: 2 } } },
    )
    expect(result).toEqual({ a: { b: { c: 1, d: 2 } } })
  })

  it('should return target when no sources', () => {
    const target = { a: 1 }
    expect(deepMerge(target)).toEqual({ a: 1 })
  })

  it('should merge multiple sources', () => {
    const result = deepMerge({ a: 1 }, { b: 2 }, { c: 3 })
    expect(result).toEqual({ a: 1, b: 2, c: 3 })
  })

  it('should handle empty source object', () => {
    const result = deepMerge({ a: 1 }, {})
    expect(result).toEqual({ a: 1 })
  })

  it('should keep target primitive when source has nested object for same key', () => {
    const result = deepMerge(
      { a: { b: 1 } },
      { a: { b: { c: 2 } } },
    )
    // deepMerge only merges when both sides are objects; primitive target is kept
    expect(result).toEqual({ a: { b: 1 } })
  })
})

describe('objectPick', () => {
  it('should pick specified keys', () => {
    const result = objectPick({ a: 1, b: 2, c: 3 }, ['a', 'c'])
    expect(result).toEqual({ a: 1, c: 3 })
  })

  it('should handle empty keys array', () => {
    const result = objectPick({ a: 1, b: 2 }, [])
    expect(result).toEqual({})
  })

  it('should omit undefined when flag is true', () => {
    const result = objectPick({ a: 1, b: undefined, c: 3 }, ['a', 'b', 'c'], true)
    expect(result).toEqual({ a: 1, c: 3 })
  })

  it('should include undefined when flag is false', () => {
    const result = objectPick({ a: 1, b: undefined, c: 3 }, ['a', 'b'], false)
    expect(result).toEqual({ a: 1, b: undefined })
  })
})

describe('clearUndefined', () => {
  it('should remove undefined fields', () => {
    const obj = { a: 1, b: undefined, c: 3 }
    const result = clearUndefined(obj)
    expect(result).toEqual({ a: 1, c: 3 })
    expect('b' in result).toBe(false)
  })

  it('should not remove null fields', () => {
    const obj = { a: 1, b: null }
    const result = clearUndefined(obj)
    expect(result).toEqual({ a: 1, b: null })
  })

  it('should return empty object unchanged', () => {
    const obj = {}
    expect(clearUndefined(obj)).toEqual({})
  })

  it('should mutate the original object', () => {
    const obj = { a: 1, b: undefined } as Record<string, unknown>
    const result = clearUndefined(obj)
    expect(result).toBe(obj)
  })
})

describe('hasOwnProperty', () => {
  it('should return true for own property', () => {
    expect(hasOwnProperty({ a: 1 }, 'a')).toBe(true)
  })

  it('should return false for non-existing property', () => {
    expect(hasOwnProperty({ a: 1 }, 'b')).toBe(false)
  })

  it('should return false for null', () => {
    expect(hasOwnProperty(null, 'a')).toBe(false)
  })

  it('should return false for undefined', () => {
    expect(hasOwnProperty(undefined, 'a')).toBe(false)
  })

  it('should not return true for inherited properties', () => {
    const obj = Object.create({ inherited: true })
    expect(hasOwnProperty(obj, 'inherited')).toBe(false)
  })
})
