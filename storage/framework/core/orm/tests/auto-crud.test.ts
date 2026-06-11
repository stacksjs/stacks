/**
 * Auto-CRUD write-path helpers (stacksjs/stacks#1949).
 *
 * Two coupled defects on the `useApi` write path:
 *   1. `store`/`update`/`destroy` routes registered with NO middleware
 *      unless the model opted in via `useApi.middleware` — a bare
 *      `useApi: true` exposed anonymous POST/PUT/PATCH/DELETE.
 *   2. Fillable attribute keys flowed verbatim (camelCase) into
 *      `insertInto(table).values(...)` while the migration drivers
 *      snake_case those same attribute names into column names — any write
 *      containing a multi-word attribute (Coupon's `discountType`,
 *      `isActive`) targeted a nonexistent column and 500'd.
 *
 * These tests lock in the extracted helpers:
 *   - toSnakeCase/toSnakeCaseKeys produce exactly what the migration
 *     drivers generate as column names (parity with @stacksjs/strings
 *     snakeCase, the function sqlite/mysql/postgres drivers use)
 *   - filterFillable accepts both attribute and column spellings,
 *     keyed back to attribute names
 *   - dropHiddenInputs strips BOTH spellings of hidden attributes
 *   - stripHidden strips BOTH spellings on the response side, so a
 *     camelCase hidden attribute can't leak via its snake column key
 *   - resolveApiMiddleware defaults mutating routes to ['auth'] unless
 *     `middleware` is explicitly declared (explicit `[]` = opt-out)
 */
import { describe, expect, it } from 'bun:test'
import { Database } from 'bun:sqlite'
import { snakeCase } from '@stacksjs/strings'
import { dropHiddenInputs, filterFillable, isUniqueViolation, mapWriteError, resolveApiMiddleware, stripHidden, toSnakeCase, toSnakeCaseKeys } from '../src/auto-crud'

describe('toSnakeCaseKeys (write-path column mapping)', () => {
  it('maps camelCase attribute keys to snake_case column keys', () => {
    expect(toSnakeCaseKeys({ isActive: 1, discountType: 'percentage', imageUrl: 'x.png' }))
      .toEqual({ is_active: 1, discount_type: 'percentage', image_url: 'x.png' })
  })

  it('is idempotent on already-snake keys', () => {
    const snake = { is_active: 1, discount_type: 'fixed' }
    expect(toSnakeCaseKeys(snake)).toEqual(snake)
    expect(toSnakeCaseKeys(toSnakeCaseKeys({ isActive: 1 }))).toEqual({ is_active: 1 })
  })

  it('passes system/timestamp/FK columns through unchanged', () => {
    const data = { created_at: 'a', updated_at: 'b', host_profile_id: 7 }
    expect(toSnakeCaseKeys(data)).toEqual(data)
  })

  it('preserves values untouched (only keys are mapped)', () => {
    const payload = { discountValue: 25.5, metaJson: { nested: true } }
    const out = toSnakeCaseKeys(payload)
    expect(out.discount_value).toBe(25.5)
    expect(out.meta_json).toBe(payload.metaJson)
  })
})

describe('toSnakeCase migration-driver parity', () => {
  // The migration drivers (database/src/drivers/{sqlite,mysql,postgres}.ts)
  // derive column names via @stacksjs/strings snakeCase. The write path must
  // produce byte-identical keys or INSERT/UPDATE targets a ghost column.
  const attributeNames = [
    'isActive',
    'discountType',
    'discountValue',
    'imageUrl',
    'practiceArea',
    'usageCount',
    'APIKey',
    'address2',
    'created_at',
  ]

  for (const name of attributeNames) {
    it(`'${name}' matches @stacksjs/strings snakeCase`, () => {
      expect(toSnakeCase(name)).toBe(snakeCase(name))
    })
  }
})

describe('filterFillable (dual-spelling input)', () => {
  const fillable = ['discountType', 'isActive', 'code']

  it('accepts the attribute-name spelling', () => {
    expect(filterFillable({ discountType: 'percentage', code: 'SAVE10' }, fillable))
      .toEqual({ discountType: 'percentage', code: 'SAVE10' })
  })

  it('accepts the snake_case column spelling, keyed back to the attribute name', () => {
    // GET responses expose snake_case columns — read-modify-write round-trips
    // submit them back in that spelling.
    expect(filterFillable({ discount_type: 'fixed', is_active: true }, fillable))
      .toEqual({ discountType: 'fixed', isActive: true })
  })

  it('prefers the attribute spelling when both are present', () => {
    expect(filterFillable({ discountType: 'a', discount_type: 'b' }, fillable))
      .toEqual({ discountType: 'a' })
  })

  it('drops non-fillable keys in both spellings', () => {
    expect(filterFillable({ usageCount: 99, usage_count: 99, id: 1 }, fillable)).toEqual({})
  })

  it('is unchanged for snake-declared attributes', () => {
    expect(filterFillable({ code: 'X', extra: 'no' }, ['code'])).toEqual({ code: 'X' })
  })

  it('returns {} for empty body or no fillable fields', () => {
    expect(filterFillable(null, fillable)).toEqual({})
    expect(filterFillable({ code: 'X' }, [])).toEqual({})
  })
})

describe('dropHiddenInputs (dual-spelling stripping)', () => {
  it('removes BOTH spellings of a camelCase hidden attribute', () => {
    const body = { paymentIntentId: 'pi_1', payment_intent_id: 'pi_2', amount: 10 }
    expect(dropHiddenInputs(body, ['paymentIntentId'])).toEqual({ amount: 10 })
  })

  it('removes snake-declared hidden attributes', () => {
    expect(dropHiddenInputs({ password: 'x', name: 'a' }, ['password'])).toEqual({ name: 'a' })
  })

  it('is a no-op with no hidden fields and does not mutate the input', () => {
    const body = { a: 1 }
    expect(dropHiddenInputs(body, [])).toBe(body)
    const withHidden = { secretKey: 's', a: 1 }
    dropHiddenInputs(withHidden, ['secretKey'])
    expect(withHidden.secretKey).toBe('s')
  })
})

describe('stripHidden (dual-spelling response stripping)', () => {
  it('removes a camelCase hidden attribute arriving under its snake column key', () => {
    // DB rows come back snake-keyed — pre-fix, Transaction's hidden
    // `paymentDetails` leaked as `payment_details` on public reads.
    const row = { id: 1, amount: 100, payment_details: { last4: '4242', brand: 'visa' } }
    expect(stripHidden(row, ['paymentDetails'])).toEqual({ id: 1, amount: 100 })
  })

  it('removes BOTH spellings when both are present', () => {
    const row = { paymentDetails: 'a', payment_details: 'b', amount: 10 }
    expect(stripHidden(row, ['paymentDetails'])).toEqual({ amount: 10 })
  })

  it('removes snake-declared hidden attributes', () => {
    expect(stripHidden({ password: 'x', name: 'a' }, ['password'])).toEqual({ name: 'a' })
  })

  it('is a no-op with no hidden fields or no record, and does not mutate the input', () => {
    const row = { a: 1 }
    expect(stripHidden(row, [])).toBe(row)
    expect(stripHidden(null, ['secretKey'])).toBeNull()
    const withHidden = { secretKey: 's', secret_key: 's2', a: 1 }
    stripHidden(withHidden, ['secretKey'])
    expect(withHidden.secretKey).toBe('s')
    expect(withHidden.secret_key).toBe('s2')
  })
})

describe('resolveApiMiddleware (secure-by-default writes)', () => {
  it('bare `useApi: true` → public reads, auth-guarded writes', () => {
    expect(resolveApiMiddleware(true)).toEqual({ read: [], write: ['auth'], declared: false })
  })

  it('default Coupon shape `{ uri }` (no middleware key) → auth-guarded writes', () => {
    expect(resolveApiMiddleware({ uri: 'coupons' })).toEqual({ read: [], write: ['auth'], declared: false })
  })

  it('explicit `middleware: ["auth"]` applies to both reads and writes', () => {
    expect(resolveApiMiddleware({ middleware: ['auth'] })).toEqual({ read: ['auth'], write: ['auth'], declared: true })
  })

  it('string shorthand `middleware: "throttle"` applies to both', () => {
    expect(resolveApiMiddleware({ middleware: 'throttle' })).toEqual({ read: ['throttle'], write: ['throttle'], declared: true })
  })

  it('explicit `middleware: []` is an honored opt-out (declared=true)', () => {
    expect(resolveApiMiddleware({ middleware: [] })).toEqual({ read: [], write: [], declared: true })
  })

  it('filters non-string/empty entries from declared lists', () => {
    expect(resolveApiMiddleware({ middleware: ['auth', '', 42 as any, null as any] }))
      .toEqual({ read: ['auth'], write: ['auth'], declared: true })
  })
})

// ─── isUniqueViolation (shared write-error predicate, #1957) ──────────
//
// Moved here from @stacksjs/auth so every framework write path can reach
// it. Mirrors auth/tests/rbac-store-bqb.test.ts's matrix so the behaviour
// stays byte-identical for register()'s 409 (which re-exports this).
describe('isUniqueViolation', () => {
  it('is true for the dialect-specific duplicate shapes', () => {
    expect(isUniqueViolation({ code: 'SQLITE_CONSTRAINT_UNIQUE' })).toBe(true)
    expect(isUniqueViolation({ code: 'SQLITE_CONSTRAINT' })).toBe(true)
    expect(isUniqueViolation({ errno: 1062 })).toBe(true)
    expect(isUniqueViolation({ code: '23505' })).toBe(true)
  })

  it('is true for unique/duplicate message-text fallbacks', () => {
    expect(isUniqueViolation({ message: 'UNIQUE constraint failed: users.email' })).toBe(true)
    expect(isUniqueViolation({ message: 'Duplicate entry for key users.email' })).toBe(true)
  })

  it('is false for anything else', () => {
    expect(isUniqueViolation({ code: 'ECONNRESET', message: 'connection lost' })).toBe(false)
    expect(isUniqueViolation(new Error('syntax error near "INSERT"'))).toBe(false)
    expect(isUniqueViolation({})).toBe(false)
    expect(isUniqueViolation(null)).toBe(false)
  })

  it('fires on the real bun:sqlite unique-violation shape', () => {
    const db = new Database(':memory:')
    db.run('CREATE TABLE cars (id INTEGER PRIMARY KEY, email TEXT)')
    db.run('CREATE UNIQUE INDEX cars_email_unique ON cars (email)')
    db.run(`INSERT INTO cars (email) VALUES ('a@b.com')`)

    let caught: unknown
    try {
      db.run(`INSERT INTO cars (email) VALUES ('a@b.com')`)
    }
    catch (err) {
      caught = err
    }
    expect(caught).toBeDefined()
    expect(isUniqueViolation(caught)).toBe(true)

    // A non-unique driver error (missing table) must NOT classify as a duplicate.
    let other: unknown
    try {
      db.run('INSERT INTO nope (x) VALUES (1)')
    }
    catch (err) {
      other = err
    }
    expect(other).toBeDefined()
    expect(isUniqueViolation(other)).toBe(false)
  })
})

// ─── mapWriteError (auto-CRUD store/update classification, #1957) ─────
describe('mapWriteError', () => {
  it('maps a duplicate create to 409 with a clean message (no driver text)', () => {
    const { status, body } = mapWriteError({ code: 'SQLITE_CONSTRAINT_UNIQUE', message: 'UNIQUE constraint failed: cars.email' }, 'Car', 'create')
    expect(status).toBe(409)
    expect(body).toEqual({ error: 'Car already exists' })
    // The raw driver text (column name) must not leak.
    expect(JSON.stringify(body)).not.toContain('UNIQUE constraint failed')
  })

  it('maps a duplicate update to 409', () => {
    const { status, body } = mapWriteError({ errno: 1062 }, 'Car', 'update')
    expect(status).toBe(409)
    expect(body).toEqual({ error: 'Car already exists' })
  })

  it('passes an HttpError-like through with its status, message and details', () => {
    const err = Object.assign(new Error('Validation failed'), { status: 422, details: { email: ['required'] } })
    const { status, body } = mapWriteError(err, 'Car', 'create')
    expect(status).toBe(422)
    expect(body).toEqual({ error: 'Validation failed', details: { email: ['required'] } })
  })

  it('passes a 413 HttpError-like through without details when none set', () => {
    const err = Object.assign(new Error('Payload Too Large'), { status: 413 })
    const { status, body } = mapWriteError(err, 'Car', 'create')
    expect(status).toBe(413)
    expect(body).toEqual({ error: 'Payload Too Large' })
  })

  it('maps a non-unique DB error to 500 with the detail preserved', () => {
    const { status, body } = mapWriteError(new Error('database is locked'), 'Car', 'create')
    expect(status).toBe(500)
    expect(body.error).toBe('Failed to create Car')
    expect(String(body.detail)).toContain('database is locked')
  })

  it('does not treat a plain Error carrying an out-of-range status as HttpError-like', () => {
    // status 200 is not 400-599 — falls through to the 500 branch.
    const err = Object.assign(new Error('weird'), { status: 200 })
    const { status } = mapWriteError(err, 'Car', 'update')
    expect(status).toBe(500)
  })
})
