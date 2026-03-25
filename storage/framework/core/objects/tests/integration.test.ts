import { describe, expect, test } from 'bun:test'
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

describe('Objects Integration Tests', () => {
  // ─── objectMap ────────────────────────────────────────────────────────────

  test('objectMap transforms values', () => {
    const result = objectMap({ a: 1, b: 2, c: 3 }, (k, v) => [k, v * 10])
    expect(result).toEqual({ a: 10, b: 20, c: 30 })
  })

  test('objectMap can swap keys and values', () => {
    const result = objectMap({ x: 'alpha', y: 'beta' }, (k, v) => [v, k])
    expect(result).toEqual({ alpha: 'x', beta: 'y' })
  })

  test('objectMap can filter entries by returning undefined', () => {
    const result = objectMap({ a: 1, b: 2, c: 3 }, (k, v) =>
      v > 1 ? [k, v] : undefined,
    )
    expect(result).toEqual({ b: 2, c: 3 })
  })

  test('objectMap with uppercase key transformation', () => {
    const result = objectMap(
      { name: 'stacks', version: '1.0' } as Record<string, string>,
      (k, v) => [k.toUpperCase(), v],
    )
    expect(result).toEqual({ NAME: 'stacks', VERSION: '1.0' })
  })

  // ─── objectKeys ──────────────────────────────────────────────────────────

  test('objectKeys returns typed array of keys', () => {
    const keys = objectKeys({ a: 1, b: 2, c: 3 })
    expect(keys).toEqual(['a', 'b', 'c'])
  })

  test('objectKeys on empty object returns empty array', () => {
    const keys = objectKeys({})
    expect(keys).toEqual([])
  })

  // ─── objectEntries ───────────────────────────────────────────────────────

  test('objectEntries returns typed [key, value] pairs', () => {
    const entries = objectEntries({ x: 10, y: 20 })
    expect(entries).toEqual([['x', 10], ['y', 20]])
  })

  test('objectEntries on single-key object', () => {
    const entries = objectEntries({ solo: true })
    expect(entries).toEqual([['solo', true]])
  })

  // ─── deepMerge ───────────────────────────────────────────────────────────

  test('deepMerge merges flat objects', () => {
    const result = deepMerge({ a: 1 }, { b: 2 })
    expect(result).toEqual({ a: 1, b: 2 })
  })

  test('deepMerge overrides values in target with source', () => {
    const result = deepMerge({ a: 1, b: 2 }, { b: 99 })
    expect(result).toEqual({ a: 1, b: 99 })
  })

  test('deepMerge handles nested objects', () => {
    const target = { level1: { level2: { a: 1 } } }
    const source = { level1: { level2: { b: 2 } } }
    const result = deepMerge(target, source)
    expect(result).toEqual({ level1: { level2: { a: 1, b: 2 } } })
  })

  test('deepMerge with multiple sources', () => {
    const result = deepMerge({ a: 1 }, { b: 2 }, { c: 3 })
    expect(result).toEqual({ a: 1, b: 2, c: 3 })
  })

  test('deepMerge does not merge arrays (replaces them)', () => {
    const result = deepMerge({ items: [1, 2] }, { items: [3, 4] })
    expect(result).toEqual({ items: [3, 4] })
  })

  test('deepMerge with no sources returns target unchanged', () => {
    const target = { x: 42 }
    const result = deepMerge(target)
    expect(result).toEqual({ x: 42 })
    expect(result).toBe(target)
  })

  // ─── objectPick ──────────────────────────────────────────────────────────

  test('objectPick selects specified keys', () => {
    const obj = { a: 1, b: 2, c: 3, d: 4 }
    const result = objectPick(obj, ['a', 'c'])
    expect(result).toEqual({ a: 1, c: 3 })
  })

  test('objectPick with non-existent keys omits them', () => {
    const obj = { a: 1, b: 2 }
    // @ts-expect-error testing runtime behavior with nonexistent key
    const result = objectPick(obj, ['a', 'z'])
    expect(result).toEqual({ a: 1 })
  })

  test('objectPick with omitUndefined skips undefined values', () => {
    const obj = { a: 1, b: undefined, c: 3 }
    const result = objectPick(obj, ['a', 'b', 'c'], true)
    expect(result).toEqual({ a: 1, c: 3 })
    expect('b' in result).toBe(false)
  })

  test('objectPick without omitUndefined keeps undefined values', () => {
    const obj = { a: 1, b: undefined }
    const result = objectPick(obj, ['a', 'b'])
    expect(result).toEqual({ a: 1, b: undefined })
    expect('b' in result).toBe(true)
  })

  // ─── clearUndefined ─────────────────────────────────────────────────────

  test('clearUndefined removes undefined properties', () => {
    const obj = { a: 1, b: undefined, c: 'hello', d: undefined }
    const result = clearUndefined(obj)
    expect(result).toEqual({ a: 1, c: 'hello' })
    expect('b' in result).toBe(false)
    expect('d' in result).toBe(false)
  })

  test('clearUndefined preserves null and falsy values', () => {
    const obj = { a: null, b: 0, c: '', d: false, e: undefined }
    clearUndefined(obj)
    expect(obj).toEqual({ a: null, b: 0, c: '', d: false })
  })

  test('clearUndefined mutates the original object', () => {
    const obj = { x: undefined, y: 1 }
    const returned = clearUndefined(obj)
    expect(returned).toBe(obj) // same reference
  })

  // ─── isKeyOf ─────────────────────────────────────────────────────────────

  test('isKeyOf returns true for existing keys', () => {
    const obj = { name: 'stacks', version: 1 }
    expect(isKeyOf(obj, 'name')).toBe(true)
    expect(isKeyOf(obj, 'version')).toBe(true)
  })

  test('isKeyOf returns false for missing keys', () => {
    const obj = { a: 1 }
    expect(isKeyOf(obj, 'b')).toBe(false)
    expect(isKeyOf(obj, 'toString')).toBe(true) // inherited from prototype
  })

  // ─── hasOwnProperty ─────────────────────────────────────────────────────

  test('hasOwnProperty checks own properties safely', () => {
    const obj = { foo: 'bar', baz: 42 }
    expect(hasOwnProperty(obj, 'foo')).toBe(true)
    expect(hasOwnProperty(obj, 'baz')).toBe(true)
    expect(hasOwnProperty(obj, 'missing')).toBe(false)
  })

  test('hasOwnProperty does not match inherited properties', () => {
    const obj = { a: 1 }
    expect(hasOwnProperty(obj, 'toString')).toBe(false)
    expect(hasOwnProperty(obj, 'hasOwnProperty')).toBe(false)
  })

  test('hasOwnProperty returns false for null/undefined', () => {
    expect(hasOwnProperty(null, 'key')).toBe(false)
    expect(hasOwnProperty(undefined, 'key')).toBe(false)
  })
})
