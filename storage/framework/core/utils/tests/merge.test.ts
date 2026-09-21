import { describe, expect, it } from 'bun:test'
import { defu, merge, mergeDefaults } from '../src/merge'

describe('merge', () => {
  it('should merge simple objects', () => {
    const result = merge({ a: 1 }, { b: 2 })
    expect(result).toEqual({ a: 1, b: 2 })
  })

  it('should merge nested objects', () => {
    const result = merge(
      { a: { b: 1, c: 2 } },
      { a: { c: 3, d: 4 } },
    )
    expect(result).toEqual({ a: { b: 1, c: 3, d: 4 } })
  })

  it('should concatenate arrays', () => {
    const result = merge({ arr: [1, 2] }, { arr: [3, 4] })
    expect(result).toEqual({ arr: [1, 2, 3, 4] })
  })

  it('should handle multiple objects', () => {
    const result = merge({ a: 1 }, { b: 2 }, { c: 3 })
    expect(result).toEqual({ a: 1, b: 2, c: 3 })
  })

  it('should override primitives', () => {
    const result = merge({ a: 1 }, { a: 2 })
    expect(result).toEqual({ a: 2 })
  })

  it('should handle null and undefined', () => {
    const result = merge({ a: null }, { b: undefined })
    expect(result).toEqual({ a: null, b: undefined })
  })

  it('should handle empty objects', () => {
    const result = merge({}, { a: 1 })
    expect(result).toEqual({ a: 1 })
  })

  it('should deep merge nested structures', () => {
    const result = merge(
      { a: { b: { c: 1 } } },
      { a: { b: { d: 2 } } },
    )
    expect(result).toEqual({ a: { b: { c: 1, d: 2 } } })
  })
})

describe('mergeDefaults', () => {
  it('should use defaults for missing values', () => {
    const result = mergeDefaults({ a: 1 }, { a: 2, b: 3 })
    expect(result).toEqual({ a: 1, b: 3 })
  })

  it('should preserve existing values', () => {
    const result = mergeDefaults({ a: 'custom' }, { a: 'default', b: 'default' })
    expect(result).toEqual({ a: 'custom', b: 'default' })
  })

  it('should handle nested defaults', () => {
    const result = mergeDefaults(
      { a: { b: 1 } },
      { a: { b: 2, c: 3 } },
    )
    expect(result).toEqual({ a: { b: 1, c: 3 } })
  })

  it('should handle empty input', () => {
    const result = mergeDefaults({}, { a: 1, b: 2 })
    expect(result).toEqual({ a: 1, b: 2 })
  })
})

describe('defu (alias)', () => {
  it('should work as alias for mergeDefaults', () => {
    const result = defu({ a: 1 }, { a: 2, b: 3 })
    expect(result).toEqual({ a: 1, b: 3 })
  })
})
