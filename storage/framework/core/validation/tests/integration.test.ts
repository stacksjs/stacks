import { describe, expect, test } from 'bun:test'
import {
  isArray,
  isBoolean,
  isFunction,
  isNull,
  isNullOrUndefined,
  isNumber,
  isObject,
  isString,
  isUndefined,
  schema,
} from '../src/index'
import { isObjectNotEmpty } from '../src/validator'

// ---------------------------------------------------------------------------
// Type-guard functions with tricky edge values
// ---------------------------------------------------------------------------
describe('isString', () => {
  test('returns true for a normal string', () => {
    expect(isString('hello')).toBe(true)
  })

  test('returns true for empty string', () => {
    expect(isString('')).toBe(true)
  })

  test('returns false for number 0', () => {
    expect(isString(0)).toBe(false)
  })

  test('returns false for boolean false', () => {
    expect(isString(false)).toBe(false)
  })

  test('returns false for null', () => {
    expect(isString(null)).toBe(false)
  })

  test('returns false for undefined', () => {
    expect(isString(undefined)).toBe(false)
  })

  test('returns false for a String object (boxed)', () => {
    // eslint-disable-next-line no-new-wrappers
    expect(isString(new String('hi'))).toBe(false)
  })
})

describe('isNumber', () => {
  test('returns true for positive integer', () => {
    expect(isNumber(42)).toBe(true)
  })

  test('returns true for zero', () => {
    expect(isNumber(0)).toBe(true)
  })

  test('returns true for negative float', () => {
    expect(isNumber(-3.14)).toBe(true)
  })

  test('returns true for Infinity', () => {
    expect(isNumber(Infinity)).toBe(true)
  })

  test('returns false for NaN', () => {
    expect(isNumber(Number.NaN)).toBe(false)
  })

  test('returns false for numeric string', () => {
    expect(isNumber('123')).toBe(false)
  })
})

describe('isBoolean', () => {
  test('returns true for true', () => {
    expect(isBoolean(true)).toBe(true)
  })

  test('returns true for false', () => {
    expect(isBoolean(false)).toBe(true)
  })

  test('returns false for 0', () => {
    expect(isBoolean(0)).toBe(false)
  })

  test('returns false for 1', () => {
    expect(isBoolean(1)).toBe(false)
  })

  test('returns false for "true" string', () => {
    expect(isBoolean('true')).toBe(false)
  })
})

describe('isObject', () => {
  test('returns true for plain object', () => {
    expect(isObject({ a: 1 })).toBe(true)
  })

  test('returns false for array', () => {
    expect(isObject([1, 2])).toBe(false)
  })

  test('returns false for null', () => {
    expect(isObject(null)).toBe(false)
  })

  test('returns true for empty object', () => {
    expect(isObject({})).toBe(true)
  })
})

describe('isArray', () => {
  test('returns true for empty array', () => {
    expect(isArray([])).toBe(true)
  })

  test('returns true for non-empty array', () => {
    expect(isArray([1, 'a', null])).toBe(true)
  })

  test('returns false for object', () => {
    expect(isArray({ length: 0 })).toBe(false)
  })
})

describe('isFunction', () => {
  test('returns true for arrow function', () => {
    expect(isFunction(() => {})).toBe(true)
  })

  test('returns false for object', () => {
    expect(isFunction({})).toBe(false)
  })
})

describe('isNull / isUndefined / isNullOrUndefined', () => {
  test('isNull true for null', () => {
    expect(isNull(null)).toBe(true)
  })

  test('isNull false for undefined', () => {
    expect(isNull(undefined)).toBe(false)
  })

  test('isUndefined true for undefined', () => {
    expect(isUndefined(undefined)).toBe(true)
  })

  test('isUndefined false for null', () => {
    expect(isUndefined(null)).toBe(false)
  })

  test('isNullOrUndefined true for null', () => {
    expect(isNullOrUndefined(null)).toBe(true)
  })

  test('isNullOrUndefined true for undefined', () => {
    expect(isNullOrUndefined(undefined)).toBe(true)
  })

  test('isNullOrUndefined false for 0', () => {
    expect(isNullOrUndefined(0)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// isObjectNotEmpty
// ---------------------------------------------------------------------------
describe('isObjectNotEmpty', () => {
  test('returns true for object with keys', () => {
    expect(isObjectNotEmpty({ a: 1 })).toBe(true)
  })

  test('returns false for empty object', () => {
    expect(isObjectNotEmpty({})).toBe(false)
  })

  test('returns false for undefined', () => {
    expect(isObjectNotEmpty(undefined)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// schema - validation library
// ---------------------------------------------------------------------------
describe('schema.string().validate()', () => {
  test('validates a normal string successfully', () => {
    const validator = schema.string()
    const result = validator.validate('hello')
    expect(result.valid).toBe(true)
  })

  test('rejects a number', () => {
    const validator = schema.string()
    const result = validator.validate(123 as any)
    expect(result.valid).toBe(false)
  })
})

describe('schema.number().min().max().validate()', () => {
  test('valid number in range passes', () => {
    const validator = schema.number().min(0).max(100)
    const result = validator.validate(50)
    expect(result.valid).toBe(true)
  })

  test('number at lower bound passes', () => {
    const validator = schema.number().min(0).max(100)
    const result = validator.validate(0)
    expect(result.valid).toBe(true)
  })

  test('number at upper bound passes', () => {
    const validator = schema.number().min(0).max(100)
    const result = validator.validate(100)
    expect(result.valid).toBe(true)
  })

  test('number below range fails', () => {
    const validator = schema.number().min(0).max(100)
    const result = validator.validate(-1)
    expect(result.valid).toBe(false)
  })

  test('number above range fails', () => {
    const validator = schema.number().min(0).max(100)
    const result = validator.validate(101)
    expect(result.valid).toBe(false)
  })

  test('string instead of number fails', () => {
    const validator = schema.number()
    const result = validator.validate('abc' as any)
    expect(result.valid).toBe(false)
  })
})
