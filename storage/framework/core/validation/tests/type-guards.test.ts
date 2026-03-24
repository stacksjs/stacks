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
} from '../src'

describe('@stacksjs/validation - Type Guards', () => {
  describe('isString', () => {
    test('returns true for a normal string', () => {
      expect(isString('hello')).toBe(true)
    })

    test('returns true for an empty string', () => {
      expect(isString('')).toBe(true)
    })

    test('returns true for a string with whitespace only', () => {
      expect(isString('   ')).toBe(true)
    })

    test('returns true for a template literal', () => {
      const val = `template ${1 + 1}`
      expect(isString(val)).toBe(true)
    })

    test('returns true for String() wrapper call', () => {
      expect(isString(String(42))).toBe(true)
    })

    test('returns false for a number', () => {
      expect(isString(42)).toBe(false)
    })

    test('returns false for zero', () => {
      expect(isString(0)).toBe(false)
    })

    test('returns false for null', () => {
      expect(isString(null)).toBe(false)
    })

    test('returns false for undefined', () => {
      expect(isString(undefined)).toBe(false)
    })

    test('returns false for boolean true', () => {
      expect(isString(true)).toBe(false)
    })

    test('returns false for boolean false', () => {
      expect(isString(false)).toBe(false)
    })

    test('returns false for a plain object', () => {
      expect(isString({})).toBe(false)
    })

    test('returns false for an array', () => {
      expect(isString([])).toBe(false)
    })

    test('returns false for a function', () => {
      expect(isString(() => {})).toBe(false)
    })

    test('returns false for a symbol', () => {
      expect(isString(Symbol('test'))).toBe(false)
    })

    test('returns false for NaN', () => {
      expect(isString(Number.NaN)).toBe(false)
    })
  })

  describe('isNumber', () => {
    test('returns true for a positive integer', () => {
      expect(isNumber(42)).toBe(true)
    })

    test('returns true for zero', () => {
      expect(isNumber(0)).toBe(true)
    })

    test('returns true for a negative number', () => {
      expect(isNumber(-10)).toBe(true)
    })

    test('returns true for a float', () => {
      expect(isNumber(3.14)).toBe(true)
    })

    test('returns true for Infinity', () => {
      expect(isNumber(Number.POSITIVE_INFINITY)).toBe(true)
    })

    test('returns true for negative Infinity', () => {
      expect(isNumber(Number.NEGATIVE_INFINITY)).toBe(true)
    })

    test('returns false for NaN', () => {
      expect(isNumber(Number.NaN)).toBe(false)
    })

    test('returns false for a numeric string', () => {
      expect(isNumber('42')).toBe(false)
    })

    test('returns false for an empty string', () => {
      expect(isNumber('')).toBe(false)
    })

    test('returns false for null', () => {
      expect(isNumber(null)).toBe(false)
    })

    test('returns false for undefined', () => {
      expect(isNumber(undefined)).toBe(false)
    })

    test('returns false for boolean', () => {
      expect(isNumber(true)).toBe(false)
    })

    test('returns false for an object', () => {
      expect(isNumber({})).toBe(false)
    })

    test('returns false for an array', () => {
      expect(isNumber([])).toBe(false)
    })

    test('returns false for a function', () => {
      expect(isNumber(() => {})).toBe(false)
    })
  })

  describe('isBoolean', () => {
    test('returns true for true', () => {
      expect(isBoolean(true)).toBe(true)
    })

    test('returns true for false', () => {
      expect(isBoolean(false)).toBe(true)
    })

    test('returns false for 0 (falsy number)', () => {
      expect(isBoolean(0)).toBe(false)
    })

    test('returns false for 1 (truthy number)', () => {
      expect(isBoolean(1)).toBe(false)
    })

    test('returns false for empty string', () => {
      expect(isBoolean('')).toBe(false)
    })

    test('returns false for string "true"', () => {
      expect(isBoolean('true')).toBe(false)
    })

    test('returns false for string "false"', () => {
      expect(isBoolean('false')).toBe(false)
    })

    test('returns false for null', () => {
      expect(isBoolean(null)).toBe(false)
    })

    test('returns false for undefined', () => {
      expect(isBoolean(undefined)).toBe(false)
    })

    test('returns false for an object', () => {
      expect(isBoolean({})).toBe(false)
    })

    test('returns false for an array', () => {
      expect(isBoolean([])).toBe(false)
    })
  })

  describe('isObject', () => {
    test('returns true for a plain object', () => {
      expect(isObject({})).toBe(true)
    })

    test('returns true for an object with properties', () => {
      expect(isObject({ a: 1, b: 2 })).toBe(true)
    })

    test('returns true for a nested object', () => {
      expect(isObject({ nested: { deep: true } })).toBe(true)
    })

    test('returns false for null (typeof null is "object")', () => {
      expect(isObject(null)).toBe(false)
    })

    test('returns false for an array (arrays are objects in JS)', () => {
      expect(isObject([])).toBe(false)
    })

    test('returns false for a string', () => {
      expect(isObject('hello')).toBe(false)
    })

    test('returns false for a number', () => {
      expect(isObject(42)).toBe(false)
    })

    test('returns false for undefined', () => {
      expect(isObject(undefined)).toBe(false)
    })

    test('returns false for a function', () => {
      expect(isObject(() => {})).toBe(false)
    })

    test('returns false for a boolean', () => {
      expect(isObject(true)).toBe(false)
    })

    test('returns false for a symbol', () => {
      expect(isObject(Symbol('test'))).toBe(false)
    })

    test('returns true for Object.create(null)', () => {
      expect(isObject(Object.create(null))).toBe(true)
    })
  })

  describe('isArray', () => {
    test('returns true for an empty array', () => {
      expect(isArray([])).toBe(true)
    })

    test('returns true for an array of numbers', () => {
      expect(isArray([1, 2, 3])).toBe(true)
    })

    test('returns true for an array of mixed types', () => {
      expect(isArray([1, 'two', true, null])).toBe(true)
    })

    test('returns true for a nested array', () => {
      expect(isArray([[1], [2]])).toBe(true)
    })

    test('returns true for Array.from result', () => {
      expect(isArray(Array.from('abc'))).toBe(true)
    })

    test('returns false for a plain object', () => {
      expect(isArray({})).toBe(false)
    })

    test('returns false for a string', () => {
      expect(isArray('hello')).toBe(false)
    })

    test('returns false for a number', () => {
      expect(isArray(42)).toBe(false)
    })

    test('returns false for null', () => {
      expect(isArray(null)).toBe(false)
    })

    test('returns false for undefined', () => {
      expect(isArray(undefined)).toBe(false)
    })

    test('returns false for a Set (array-like but not array)', () => {
      expect(isArray(new Set([1, 2]))).toBe(false)
    })

    test('returns false for arguments-like objects', () => {
      expect(isArray({ length: 0 })).toBe(false)
    })
  })

  describe('isFunction', () => {
    test('returns true for an arrow function', () => {
      expect(isFunction(() => {})).toBe(true)
    })

    test('returns true for a regular function', () => {
      // eslint-disable-next-line prefer-arrow-callback
      expect(isFunction(function namedFn() {})).toBe(true)
    })

    test('returns true for an async function', () => {
      expect(isFunction(async () => {})).toBe(true)
    })

    test('returns true for a generator function', () => {
      // eslint-disable-next-line no-empty-function
      function* gen() {}
      expect(isFunction(gen)).toBe(true)
    })

    test('returns true for a class (classes are functions)', () => {
      class Foo {}
      expect(isFunction(Foo)).toBe(true)
    })

    test('returns true for built-in functions', () => {
      expect(isFunction(Array.isArray)).toBe(true)
    })

    test('returns false for a plain object', () => {
      expect(isFunction({})).toBe(false)
    })

    test('returns false for a string', () => {
      expect(isFunction('function')).toBe(false)
    })

    test('returns false for a number', () => {
      expect(isFunction(42)).toBe(false)
    })

    test('returns false for null', () => {
      expect(isFunction(null)).toBe(false)
    })

    test('returns false for undefined', () => {
      expect(isFunction(undefined)).toBe(false)
    })

    test('returns false for an array', () => {
      expect(isFunction([])).toBe(false)
    })

    test('returns false for a boolean', () => {
      expect(isFunction(true)).toBe(false)
    })
  })

  describe('isUndefined', () => {
    test('returns true for undefined', () => {
      expect(isUndefined(undefined)).toBe(true)
    })

    test('returns true for void 0', () => {
      // eslint-disable-next-line no-void
      expect(isUndefined(void 0)).toBe(true)
    })

    test('returns false for null', () => {
      expect(isUndefined(null)).toBe(false)
    })

    test('returns false for zero', () => {
      expect(isUndefined(0)).toBe(false)
    })

    test('returns false for empty string', () => {
      expect(isUndefined('')).toBe(false)
    })

    test('returns false for false', () => {
      expect(isUndefined(false)).toBe(false)
    })

    test('returns false for NaN', () => {
      expect(isUndefined(Number.NaN)).toBe(false)
    })

    test('returns false for an empty object', () => {
      expect(isUndefined({})).toBe(false)
    })

    test('returns false for an empty array', () => {
      expect(isUndefined([])).toBe(false)
    })
  })

  describe('isNull', () => {
    test('returns true for null', () => {
      expect(isNull(null)).toBe(true)
    })

    test('returns false for undefined', () => {
      expect(isNull(undefined)).toBe(false)
    })

    test('returns false for zero', () => {
      expect(isNull(0)).toBe(false)
    })

    test('returns false for empty string', () => {
      expect(isNull('')).toBe(false)
    })

    test('returns false for false', () => {
      expect(isNull(false)).toBe(false)
    })

    test('returns false for NaN', () => {
      expect(isNull(Number.NaN)).toBe(false)
    })

    test('returns false for an empty object', () => {
      expect(isNull({})).toBe(false)
    })

    test('returns false for the string "null"', () => {
      expect(isNull('null')).toBe(false)
    })
  })

  describe('isNullOrUndefined', () => {
    test('returns true for null', () => {
      expect(isNullOrUndefined(null)).toBe(true)
    })

    test('returns true for undefined', () => {
      expect(isNullOrUndefined(undefined)).toBe(true)
    })

    test('returns true for void 0', () => {
      // eslint-disable-next-line no-void
      expect(isNullOrUndefined(void 0)).toBe(true)
    })

    test('returns false for zero', () => {
      expect(isNullOrUndefined(0)).toBe(false)
    })

    test('returns false for empty string', () => {
      expect(isNullOrUndefined('')).toBe(false)
    })

    test('returns false for false', () => {
      expect(isNullOrUndefined(false)).toBe(false)
    })

    test('returns false for NaN', () => {
      expect(isNullOrUndefined(Number.NaN)).toBe(false)
    })

    test('returns false for an empty object', () => {
      expect(isNullOrUndefined({})).toBe(false)
    })

    test('returns false for an empty array', () => {
      expect(isNullOrUndefined([])).toBe(false)
    })

    test('returns false for a non-empty string', () => {
      expect(isNullOrUndefined('hello')).toBe(false)
    })

    test('returns false for a number', () => {
      expect(isNullOrUndefined(42)).toBe(false)
    })
  })
})
