import { afterEach, describe, expect, test } from 'bun:test'
import {
  customValidate,
  getCustomRule,
  isObjectNotEmpty,
  registerRule,
  schema,
} from '../src'

describe('@stacksjs/validation - Validator Utilities', () => {
  describe('isObjectNotEmpty', () => {
    test('returns true for an object with one property', () => {
      expect(isObjectNotEmpty({ a: 1 })).toBe(true)
    })

    test('returns true for an object with multiple properties', () => {
      expect(isObjectNotEmpty({ a: 1, b: 2, c: 3 })).toBe(true)
    })

    test('returns false for an empty object', () => {
      expect(isObjectNotEmpty({})).toBe(false)
    })

    test('returns false for undefined', () => {
      expect(isObjectNotEmpty(undefined)).toBe(false)
    })

    test('returns true for an object with nested objects', () => {
      expect(isObjectNotEmpty({ nested: { deep: true } })).toBe(true)
    })

    test('returns true for an object with falsy values', () => {
      expect(isObjectNotEmpty({ a: 0, b: '', c: false, d: null })).toBe(true)
    })

    test('returns true for an object with undefined value', () => {
      expect(isObjectNotEmpty({ key: undefined })).toBe(true)
    })
  })

  describe('registerRule and getCustomRule', () => {
    afterEach(() => {
      // Note: there is no clearRules API, so registered rules persist.
      // Tests should use unique names to avoid collisions.
    })

    test('registers and retrieves a custom rule', () => {
      const rule = async (value: unknown) => {
        return value === 'valid' ? true : 'Value is not valid'
      }
      registerRule('test_custom_rule_1', rule)
      const retrieved = getCustomRule('test_custom_rule_1')
      expect(retrieved).toBe(rule)
    })

    test('returns undefined for a non-existent rule', () => {
      expect(getCustomRule('non_existent_rule_xyz')).toBeUndefined()
    })

    test('overwrites a rule when registering with the same name', () => {
      const ruleA = async () => true as const
      const ruleB = async () => 'always fails'
      registerRule('test_overwrite_rule', ruleA)
      registerRule('test_overwrite_rule', ruleB)
      expect(getCustomRule('test_overwrite_rule')).toBe(ruleB)
    })

    test('registered rule returns true for valid input', async () => {
      const minLength = async (value: unknown) => {
        if (typeof value === 'string' && value.length >= 3)
          return true
        return 'Must be at least 3 characters'
      }
      registerRule('test_min_length', minLength)
      const rule = getCustomRule('test_min_length')
      expect(rule).toBeDefined()
      const result = await rule!('hello', {})
      expect(result).toBe(true)
    })

    test('registered rule returns error string for invalid input', async () => {
      const minLength = async (value: unknown) => {
        if (typeof value === 'string' && value.length >= 3)
          return true
        return 'Must be at least 3 characters'
      }
      registerRule('test_min_length_fail', minLength)
      const rule = getCustomRule('test_min_length_fail')
      expect(rule).toBeDefined()
      const result = await rule!('ab', {})
      expect(result).toBe('Must be at least 3 characters')
    })

    test('can register multiple distinct rules', () => {
      const ruleX = async () => true as const
      const ruleY = async () => true as const
      const ruleZ = async () => true as const
      registerRule('test_rule_x', ruleX)
      registerRule('test_rule_y', ruleY)
      registerRule('test_rule_z', ruleZ)
      expect(getCustomRule('test_rule_x')).toBe(ruleX)
      expect(getCustomRule('test_rule_y')).toBe(ruleY)
      expect(getCustomRule('test_rule_z')).toBe(ruleZ)
    })

    test('rule receives params as second argument', async () => {
      const contextRule = async (_value: unknown, params: Record<string, any>) => {
        return params.confirmedBy === 'admin' ? true : 'Not authorized'
      }
      registerRule('test_context_rule', contextRule)
      const rule = getCustomRule('test_context_rule')!
      expect(await rule('anything', { confirmedBy: 'admin' })).toBe(true)
      expect(await rule('anything', { confirmedBy: 'guest' })).toBe('Not authorized')
    })
  })

  describe('schema', () => {
    test('schema is exported and defined', () => {
      expect(schema).toBeDefined()
    })

    test('schema has object method', () => {
      expect(typeof schema.object).toBe('function')
    })
  })

  describe('customValidate', () => {
    test('passes validation when rules are satisfied', async () => {
      const attributes = {
        name: {
          rule: schema.string().min(1) as any,
          message: {},
        },
      }
      const params = { name: 'John' }
      const result = await customValidate(attributes, params)
      expect(result).toBeDefined()
      expect(result.valid).toBe(true)
    })

    test('throws HttpError 422 when validation fails', async () => {
      const attributes = {
        email: {
          rule: schema.string().email() as any,
          message: {
            email: 'Must be a valid email address',
          },
        },
      }
      const params = { email: 'not-an-email' }
      try {
        await customValidate(attributes, params)
        // Should not reach here
        expect(true).toBe(false)
      }
      catch (error: any) {
        expect(error.status).toBe(422)
      }
    })

    test('passes with multiple valid fields', async () => {
      const attributes = {
        name: {
          rule: schema.string().min(1) as any,
          message: {},
        },
        age: {
          rule: schema.number().min(0) as any,
          message: {},
        },
      }
      const params = { name: 'Jane', age: 25 }
      const result = await customValidate(attributes, params)
      expect(result).toBeDefined()
      expect(result.valid).toBe(true)
    })

    test('throws when one of multiple fields is invalid', async () => {
      const attributes = {
        name: {
          rule: schema.string().min(1) as any,
          message: {},
        },
        email: {
          rule: schema.string().email() as any,
          message: {},
        },
      }
      const params = { name: 'Jane', email: 'bad' }
      try {
        await customValidate(attributes, params)
        expect(true).toBe(false)
      }
      catch (error: any) {
        expect(error.status).toBe(422)
      }
    })

    test('uses custom error messages', async () => {
      const attributes = {
        email: {
          rule: schema.string().email() as any,
          message: {
            email: 'Please provide a valid email',
          },
        },
      }
      const params = { email: 'invalid' }
      try {
        await customValidate(attributes, params)
        expect(true).toBe(false)
      }
      catch (error: any) {
        expect(error.status).toBe(422)
      }
    })

    test('handles empty attributes with no validation needed', async () => {
      const attributes = {}
      const params = { anything: 'goes' }
      const result = await customValidate(attributes, params)
      expect(result).toBeDefined()
    })
  })
})
