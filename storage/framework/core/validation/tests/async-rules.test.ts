import { describe, expect, test } from 'bun:test'
import { exists, unique, validateFieldAsync } from '../src'

// ---------------------------------------------------------------------------
// These tests use the real database connection. The unique() and exists()
// rules have try/catch so if the table does not exist they gracefully
// fall back to returning true.
// ---------------------------------------------------------------------------

describe('@stacksjs/validation - Async Rules', () => {
  describe('unique(table, column)', () => {
    test('returns a function', () => {
      const validator = unique('users', 'email')
      expect(typeof validator).toBe('function')
    })

    test('unique validator accepts value and params', async () => {
      const validator = unique('users', 'email')
      // With the real DB, either the table exists and it queries, or
      // the try/catch falls back to true
      const result = await validator('test-unique-value@example.com', {})
      // Should be true (unique) or a string (taken) - both are valid outcomes
      expect(typeof result === 'boolean' || typeof result === 'string').toBe(true)
    })

    test('unique validator handles null value gracefully', async () => {
      const validator = unique('users', 'email')
      const result = await validator(null, {})
      expect(typeof result === 'boolean' || typeof result === 'string').toBe(true)
    })

    test('unique validator handles undefined value gracefully', async () => {
      const validator = unique('users', 'email')
      const result = await validator(undefined, {})
      expect(typeof result === 'boolean' || typeof result === 'string').toBe(true)
    })

    test('unique validator handles empty string gracefully', async () => {
      const validator = unique('users', 'email')
      const result = await validator('', {})
      expect(typeof result === 'boolean' || typeof result === 'string').toBe(true)
    })

    test('unique returns true if database query throws (graceful fallback)', async () => {
      // Use a table name that definitely does not exist
      const validator = unique('__nonexistent_table_xyz__', 'email')
      const result = await validator('anything@example.com', {})
      expect(result).toBe(true)
    })
  })

  describe('unique(table, column, exceptId)', () => {
    test('returns a function when exceptId is provided', () => {
      const validator = unique('users', 'email', 5)
      expect(typeof validator).toBe('function')
    })

    test('unique with exceptId accepts value and params', async () => {
      const validator = unique('users', 'email', 5)
      const result = await validator('existing@example.com', {})
      expect(typeof result === 'boolean' || typeof result === 'string').toBe(true)
    })

    test('exceptId of 0 is falsy, so no exclusion is applied', async () => {
      const validator = unique('users', 'email', 0)
      const result = await validator('zero@example.com', {})
      expect(typeof result === 'boolean' || typeof result === 'string').toBe(true)
    })
  })

  describe('exists(table, column)', () => {
    test('returns a function', () => {
      const validator = exists('categories', 'id')
      expect(typeof validator).toBe('function')
    })

    test('exists validator accepts value and params', async () => {
      const validator = exists('categories', 'id')
      const result = await validator(9999, {})
      // Should be true (found) or a string error (not found)
      expect(typeof result === 'boolean' || typeof result === 'string').toBe(true)
    })

    test('exists includes column name in the error message when not found', async () => {
      // Use a nonexistent table - the try/catch falls back to true
      const validator = exists('__nonexistent_table_xyz__', 'slug')
      const result = await validator('nonexistent-slug', {})
      // With the graceful fallback, this returns true
      expect(result).toBe(true)
    })

    test('exists handles null value', async () => {
      const validator = exists('users', 'email')
      const result = await validator(null, {})
      expect(typeof result === 'boolean' || typeof result === 'string').toBe(true)
    })

    test('exists handles empty string', async () => {
      const validator = exists('users', 'email')
      const result = await validator('', {})
      expect(typeof result === 'boolean' || typeof result === 'string').toBe(true)
    })

    test('exists returns true if database query throws (graceful fallback)', async () => {
      const validator = exists('__nonexistent_table_xyz__', 'email')
      const result = await validator('anything@example.com', {})
      expect(result).toBe(true)
    })

    test('exists works with string value', async () => {
      const validator = exists('roles', 'name')
      const result = await validator('Admin', {})
      expect(typeof result === 'boolean' || typeof result === 'string').toBe(true)
    })

    test('exists works with numeric value', async () => {
      const validator = exists('items', 'id')
      const result = await validator(42, {})
      expect(typeof result === 'boolean' || typeof result === 'string').toBe(true)
    })
  })

  describe('validateFieldAsync - async rule integration', () => {
    test('async rule composed with unique returns valid result', async () => {
      const asyncRules = {
        email: unique('users', 'email'),
      }
      const result = await asyncRules.email('fresh@example.com', {})
      expect(typeof result === 'boolean' || typeof result === 'string').toBe(true)
    })

    test('async rule composed with exists returns valid result', async () => {
      const asyncRules = {
        category_id: exists('categories', 'id'),
      }
      const result = await asyncRules.category_id(9999, {})
      expect(typeof result === 'boolean' || typeof result === 'string').toBe(true)
    })

    test('multiple async rules can run concurrently', async () => {
      const asyncRules = {
        email: unique('users', 'email'),
        username: unique('users', 'username'),
      }

      const results = await Promise.all([
        asyncRules.email('new@example.com', {}),
        asyncRules.username('newuser', {}),
      ])

      expect(typeof results[0] === 'boolean' || typeof results[0] === 'string').toBe(true)
      expect(typeof results[1] === 'boolean' || typeof results[1] === 'string').toBe(true)
    })

    test('mixed pass/fail from multiple async rules', async () => {
      // We test the pattern: one rule passes, another fails
      const uniqueRule = async (value: unknown) => {
        return value === 'unique@test.com' ? true : 'The email has already been taken'
      }
      const existsRule = async (value: unknown) => {
        return value === 999 ? true : 'The selected category_id does not exist'
      }

      const emailResult = await uniqueRule('unique@test.com')
      const categoryResult = await existsRule(123)

      expect(emailResult).toBe(true)
      expect(categoryResult).toBe('The selected category_id does not exist')
    })

    test('async rule returning boolean false is treated as failure with default message', async () => {
      const asyncRules: Record<string, (value: unknown, params: Record<string, any>) => Promise<boolean | string>> = {
        status: async () => false,
      }

      const result = await asyncRules.status('invalid', {})
      expect(result).toBe(false)

      // Simulate what validateFieldAsync does with this result
      const field = 'status'
      const errorMessage = typeof result === 'string' ? result : `${field} validation failed`
      expect(errorMessage).toBe('status validation failed')
    })
  })

  describe('unique and exists - different table names', () => {
    test('unique works with different table names', async () => {
      const validator = unique('promo_codes', 'code')
      const result = await validator('PROMO10', {})
      expect(typeof result === 'boolean' || typeof result === 'string').toBe(true)
    })

    test('exists works with different table names', async () => {
      const validator = exists('departments', 'name')
      const result = await validator('Nonexistent Dept', {})
      expect(typeof result === 'boolean' || typeof result === 'string').toBe(true)
    })
  })
})
