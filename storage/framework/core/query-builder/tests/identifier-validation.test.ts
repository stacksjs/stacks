import { describe, expect, test } from 'bun:test'
import {
  assertSafeIdentifier,
  assertSafeOperator,
  isSafeOperator,
  validateIdentifier,
} from '../src/index'

/**
 * Tests for the identifier + operator validators added by
 * stacksjs/stacks#1858. These give Stacks code a single chokepoint
 * to validate at when interpolating untrusted input into SQL
 * identifiers — the underlying vendored runtime fixes are tracked
 * upstream.
 */

describe('validateIdentifier', () => {
  test('accepts simple column names', () => {
    expect(validateIdentifier('id')).toEqual({ valid: true })
    expect(validateIdentifier('user_id')).toEqual({ valid: true })
    expect(validateIdentifier('createdAt')).toEqual({ valid: true })
    expect(validateIdentifier('_internal_field')).toEqual({ valid: true })
    expect(validateIdentifier('field2')).toEqual({ valid: true })
  })

  test('rejects empty / non-string', () => {
    expect(validateIdentifier('')).toEqual({ valid: false, reason: 'empty' })
    expect(validateIdentifier(undefined)).toEqual({ valid: false, reason: 'empty' })
    expect(validateIdentifier(null)).toEqual({ valid: false, reason: 'empty' })
    expect(validateIdentifier(42)).toEqual({ valid: false, reason: 'empty' })
  })

  test('rejects names starting with a digit', () => {
    expect(validateIdentifier('2name').valid).toBe(false)
    expect(validateIdentifier('2name').reason).toBe('invalid-shape')
  })

  test('rejects SQL-injection shapes', () => {
    expect(validateIdentifier('name; DROP TABLE users--').valid).toBe(false)
    expect(validateIdentifier(`name'`).valid).toBe(false)
    expect(validateIdentifier('name OR 1=1').valid).toBe(false)
    expect(validateIdentifier('users.email').valid).toBe(false) // dots rejected; split + validate per segment
  })

  test('rejects names with quotes / backticks', () => {
    expect(validateIdentifier(`"name"`).valid).toBe(false)
    expect(validateIdentifier('`name`').valid).toBe(false)
  })

  test('rejects names > 64 chars', () => {
    const long = 'a'.repeat(65)
    expect(validateIdentifier(long)).toEqual({ valid: false, reason: 'too-long' })
    expect(validateIdentifier('a'.repeat(64))).toEqual({ valid: true })
  })

  test('enforces allowlist when provided', () => {
    const allowed = ['name', 'email', 'created_at']
    expect(validateIdentifier('name', { allowlist: allowed })).toEqual({ valid: true })
    expect(validateIdentifier('password', { allowlist: allowed })).toEqual({ valid: false, reason: 'not-in-allowlist' })
    // Still rejects invalid-shape even when the bad value would appear in allowlist
    expect(validateIdentifier('name; --', { allowlist: ['name; --', 'name'] }).reason).toBe('invalid-shape')
  })
})

describe('assertSafeIdentifier', () => {
  test('returns silently for valid identifiers', () => {
    expect(() => assertSafeIdentifier('email')).not.toThrow()
  })

  test('throws with the offending value + reason', () => {
    expect(() => assertSafeIdentifier('email; DROP TABLE')).toThrow(/Refusing to use/)
    expect(() => assertSafeIdentifier('email; DROP TABLE')).toThrow(/invalid-shape/)
  })

  test('includes context in the error message when provided', () => {
    expect(() => assertSafeIdentifier('1name', { context: 'orderBy' })).toThrow(/in orderBy/)
  })
})

describe('isSafeOperator / assertSafeOperator', () => {
  test('accepts the documented SQL operators', () => {
    for (const op of ['=', '!=', '<>', '<', '<=', '>', '>=', 'like', 'not like', 'ilike', 'in', 'not in', 'is', 'is not', 'between']) {
      expect(isSafeOperator(op)).toBe(true)
    }
  })

  test('accepts upper / mixed case variants of word operators', () => {
    expect(isSafeOperator('LIKE')).toBe(true)
    expect(isSafeOperator('Not Like')).toBe(true)
    expect(isSafeOperator('IS NOT')).toBe(true)
  })

  test('rejects injection shapes', () => {
    expect(isSafeOperator('= 1 OR 1=1 --')).toBe(false)
    expect(isSafeOperator('; DROP TABLE')).toBe(false)
    expect(isSafeOperator('')).toBe(false)
    expect(isSafeOperator(undefined)).toBe(false)
    expect(isSafeOperator(42)).toBe(false)
  })

  test('assertSafeOperator throws on bad input', () => {
    expect(() => assertSafeOperator('= 1 OR 1=1')).toThrow(/not in the allowed set/)
    expect(() => assertSafeOperator('= 1 OR 1=1', 'whereColumn')).toThrow(/in whereColumn/)
  })
})
