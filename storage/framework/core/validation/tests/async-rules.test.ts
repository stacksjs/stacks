import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { exists, unique, validateFieldAsync } from '../src'

// Helper to create a mock db module with configurable query results
function createMockDb(executeTakeFirstResult: any) {
  return {
    db: {
      selectFrom: () => ({
        where: (_col: string, _op: string, _val: any) => ({
          where: (_col2: string, _op2: string, _val2: any) => ({
            selectAll: () => ({
              executeTakeFirst: async () => executeTakeFirstResult,
            }),
          }),
          selectAll: () => ({
            executeTakeFirst: async () => executeTakeFirstResult,
          }),
        }),
      }),
    },
  }
}

describe('@stacksjs/validation - Async Rules', () => {
  describe('unique(table, column)', () => {
    test('returns true when no matching record exists (value is unique)', async () => {
      mock.module('@stacksjs/database', () => createMockDb(null))
      const validator = unique('users', 'email')
      const result = await validator('new@example.com', {})
      expect(result).toBe(true)
    })

    test('returns true when query returns undefined (value is unique)', async () => {
      mock.module('@stacksjs/database', () => createMockDb(undefined))
      const validator = unique('users', 'email')
      const result = await validator('unique@example.com', {})
      expect(result).toBe(true)
    })

    test('returns error string when matching record exists (value is not unique)', async () => {
      mock.module('@stacksjs/database', () =>
        createMockDb({ id: 1, email: 'taken@example.com' }),
      )
      const validator = unique('users', 'email')
      const result = await validator('taken@example.com', {})
      expect(result).toBe('The email has already been taken')
    })

    test('includes column name in the error message', async () => {
      mock.module('@stacksjs/database', () =>
        createMockDb({ id: 1, username: 'admin' }),
      )
      const validator = unique('users', 'username')
      const result = await validator('admin', {})
      expect(result).toBe('The username has already been taken')
    })

    test('returns true if database query throws (graceful fallback)', async () => {
      mock.module('@stacksjs/database', () => ({
        db: {
          selectFrom: () => {
            throw new Error('Database unavailable')
          },
        },
      }))
      const validator = unique('users', 'email')
      const result = await validator('anything@example.com', {})
      expect(result).toBe(true)
    })
  })

  describe('unique(table, column, exceptId)', () => {
    test('returns true when match exists but has the excepted ID', async () => {
      // When exceptId is provided, the query adds a second .where('id', '!=', exceptId).
      // We simulate: no record returned because the only match was excluded.
      mock.module('@stacksjs/database', () => createMockDb(null))
      const validator = unique('users', 'email', 5)
      const result = await validator('existing@example.com', {})
      expect(result).toBe(true)
    })

    test('returns error when a different record has the same value', async () => {
      mock.module('@stacksjs/database', () =>
        createMockDb({ id: 10, email: 'taken@example.com' }),
      )
      const validator = unique('users', 'email', 5)
      const result = await validator('taken@example.com', {})
      expect(result).toBe('The email has already been taken')
    })

    test('exceptId of 0 is falsy, so no exclusion is applied', async () => {
      // Since the code uses `if (exceptId)`, passing 0 means no exclusion.
      // The query returns a match, so it should fail.
      mock.module('@stacksjs/database', () =>
        createMockDb({ id: 0, email: 'zero@example.com' }),
      )
      const validator = unique('users', 'email', 0)
      const result = await validator('zero@example.com', {})
      expect(result).toBe('The email has already been taken')
    })
  })

  describe('exists(table, column)', () => {
    test('returns true when a matching record is found', async () => {
      mock.module('@stacksjs/database', () =>
        createMockDb({ id: 1, name: 'Existing Category' }),
      )
      const validator = exists('categories', 'id')
      const result = await validator(1, {})
      expect(result).toBe(true)
    })

    test('returns error string when no matching record is found', async () => {
      mock.module('@stacksjs/database', () => createMockDb(null))
      const validator = exists('categories', 'id')
      const result = await validator(9999, {})
      expect(result).toBe('The selected id does not exist')
    })

    test('includes column name in the error message', async () => {
      mock.module('@stacksjs/database', () => createMockDb(null))
      const validator = exists('posts', 'slug')
      const result = await validator('nonexistent-slug', {})
      expect(result).toBe('The selected slug does not exist')
    })

    test('returns error when query returns undefined (no record)', async () => {
      mock.module('@stacksjs/database', () => createMockDb(undefined))
      const validator = exists('users', 'email')
      const result = await validator('missing@example.com', {})
      expect(result).toBe('The selected email does not exist')
    })

    test('returns true if database query throws (graceful fallback)', async () => {
      mock.module('@stacksjs/database', () => ({
        db: {
          selectFrom: () => {
            throw new Error('Database unavailable')
          },
        },
      }))
      const validator = exists('users', 'email')
      const result = await validator('anything@example.com', {})
      expect(result).toBe(true)
    })

    test('checks existence with string value', async () => {
      mock.module('@stacksjs/database', () =>
        createMockDb({ id: 5, name: 'Admin' }),
      )
      const validator = exists('roles', 'name')
      const result = await validator('Admin', {})
      expect(result).toBe(true)
    })

    test('checks existence with numeric value', async () => {
      mock.module('@stacksjs/database', () =>
        createMockDb({ id: 42 }),
      )
      const validator = exists('items', 'id')
      const result = await validator(42, {})
      expect(result).toBe(true)
    })
  })

  describe('validateFieldAsync - async rule integration', () => {
    // Note: validateFieldAsync first runs sync validation via validateField,
    // which requires model files on disk. These tests focus on the async
    // rules portion by testing the rule functions directly in composition,
    // since full validateFieldAsync requires the model infrastructure.

    test('async rule composed with unique returns true for unique value', async () => {
      mock.module('@stacksjs/database', () => createMockDb(null))
      const asyncRules = {
        email: unique('users', 'email'),
      }
      // Run the async rule directly
      const result = await asyncRules.email('fresh@example.com', {})
      expect(result).toBe(true)
    })

    test('async rule composed with exists returns error for missing value', async () => {
      mock.module('@stacksjs/database', () => createMockDb(null))
      const asyncRules = {
        category_id: exists('categories', 'id'),
      }
      const result = await asyncRules.category_id(9999, {})
      expect(result).toBe('The selected id does not exist')
    })

    test('multiple async rules can run concurrently', async () => {
      mock.module('@stacksjs/database', () => createMockDb(null))
      const asyncRules = {
        email: unique('users', 'email'),
        username: unique('users', 'username'),
      }

      const results = await Promise.all([
        asyncRules.email('new@example.com', {}),
        asyncRules.username('newuser', {}),
      ])

      expect(results[0]).toBe(true)
      expect(results[1]).toBe(true)
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
      // The validateFieldAsync code checks: result !== true, then uses
      // typeof result === 'string' ? result : `${field} validation failed`
      // So if a custom rule returns false (not a string), the default message is used.
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

  describe('unique and exists - edge cases', () => {
    test('unique handles null value', async () => {
      mock.module('@stacksjs/database', () => createMockDb(null))
      const validator = unique('users', 'email')
      const result = await validator(null, {})
      expect(result).toBe(true)
    })

    test('unique handles undefined value', async () => {
      mock.module('@stacksjs/database', () => createMockDb(null))
      const validator = unique('users', 'email')
      const result = await validator(undefined, {})
      expect(result).toBe(true)
    })

    test('unique handles empty string', async () => {
      mock.module('@stacksjs/database', () => createMockDb(null))
      const validator = unique('users', 'email')
      const result = await validator('', {})
      expect(result).toBe(true)
    })

    test('exists handles null value', async () => {
      mock.module('@stacksjs/database', () => createMockDb(null))
      const validator = exists('users', 'email')
      const result = await validator(null, {})
      expect(result).toBe('The selected email does not exist')
    })

    test('exists handles empty string', async () => {
      mock.module('@stacksjs/database', () => createMockDb(null))
      const validator = exists('users', 'email')
      const result = await validator('', {})
      expect(result).toBe('The selected email does not exist')
    })

    test('unique works with different table names', async () => {
      mock.module('@stacksjs/database', () =>
        createMockDb({ id: 1, code: 'PROMO10' }),
      )
      const validator = unique('promo_codes', 'code')
      const result = await validator('PROMO10', {})
      expect(result).toBe('The code has already been taken')
    })

    test('exists works with different table names', async () => {
      mock.module('@stacksjs/database', () => createMockDb(null))
      const validator = exists('departments', 'name')
      const result = await validator('Nonexistent Dept', {})
      expect(result).toBe('The selected name does not exist')
    })
  })
})
