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
import { applyCasts, applySorting, buildIndexMeta, buildIndexPaginator, buildReadColumnMap, dropHiddenInputs, filterFillable, INDEX_DEFAULT_PER_PAGE, INDEX_MAX_PER_PAGE, isUniqueViolation, mapWriteError, resolveApiMiddleware, resolveIndexPageArgs, stripHidden, toSnakeCase, toSnakeCaseKeys } from '../src/auto-crud'
import { toPaginator } from '../src/paginator'

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

describe('buildReadColumnMap (read-path sort/filter allowlist)', () => {
  const attributes = {
    discountType: { fillable: true },
    code: { fillable: true },
    paymentDetails: { hidden: true },
    two_factor_secret: { hidden: true },
  }
  const hidden = ['paymentDetails', 'two_factor_secret']

  it('resolves BOTH spellings of a camelCase attribute to the snake column', () => {
    const map = buildReadColumnMap(attributes, hidden)
    expect(map.get('discountType')).toBe('discount_type')
    expect(map.get('discount_type')).toBe('discount_type')
  })

  it('keeps snake-declared attributes under their single spelling', () => {
    const map = buildReadColumnMap(attributes, hidden)
    expect(map.get('code')).toBe('code')
  })

  it('includes system columns', () => {
    const map = buildReadColumnMap(attributes, hidden)
    for (const col of ['id', 'uuid', 'created_at', 'updated_at', 'deleted_at'])
      expect(map.get(col)).toBe(col)
  })

  it('excludes hidden attributes under BOTH spellings', () => {
    const map = buildReadColumnMap(attributes, hidden)
    expect(map.has('paymentDetails')).toBe(false)
    expect(map.has('payment_details')).toBe(false)
    expect(map.has('two_factor_secret')).toBe(false)
  })

  it('does not contain unknown names', () => {
    const map = buildReadColumnMap(attributes, hidden)
    expect(map.has('nope')).toBe(false)
    expect(map.has('password_reset_token')).toBe(false)
  })

  it('tolerates a missing attributes object (system columns only)', () => {
    const map = buildReadColumnMap(undefined, [])
    expect(map.get('id')).toBe('id')
    expect(map.size).toBe(5)
  })
})

describe('applySorting (allowlist + camel→snake mapping)', () => {
  const columns = buildReadColumnMap(
    { discountType: {}, createdAt: {}, name: {}, paymentDetails: { hidden: true } },
    ['paymentDetails'],
  )

  function recordingQuery() {
    const calls: Array<[string, string]> = []
    const q: any = {
      orderBy(col: string, dir: string) {
        calls.push([col, dir])
        return q
      },
    }
    return { q, calls }
  }

  it('maps camelCase tokens to snake columns with direction', () => {
    // Pre-fix headline bug: `?sort=discountType` passed the allowlist but
    // ordered by the ghost column `discountType` (500), while the REAL
    // column spelling `discount_type` was rejected by the allowlist.
    const { q, calls } = recordingQuery()
    applySorting(q, 'discountType,-createdAt', columns)
    expect(calls).toEqual([['discount_type', 'asc'], ['created_at', 'desc']])
  })

  it('accepts the snake column spelling directly', () => {
    const { q, calls } = recordingQuery()
    applySorting(q, 'discount_type', columns)
    expect(calls).toEqual([['discount_type', 'asc']])
  })

  it('skips unknown attributes', () => {
    const { q, calls } = recordingQuery()
    applySorting(q, 'nope,-alsonope', columns)
    expect(calls).toEqual([])
  })

  it('skips hidden attributes under BOTH spellings (enumeration oracle stays closed)', () => {
    const { q, calls } = recordingQuery()
    applySorting(q, 'paymentDetails,-payment_details', columns)
    expect(calls).toEqual([])
  })

  it('skips non-word tokens', () => {
    const { q, calls } = recordingQuery()
    applySorting(q, 'name;drop table users,(name),na me', columns)
    expect(calls).toEqual([])
  })

  it('returns the query untouched for a null sort param', () => {
    const { q, calls } = recordingQuery()
    expect(applySorting(q, null, columns)).toBe(q)
    expect(calls).toEqual([])
  })
})

describe('applyCasts (dual-spelling read/write casts)', () => {
  it('get-direction applies a camel-keyed cast to a snake-keyed DB row', () => {
    // Pre-fix headline bug: cast declared `instantBook: 'boolean'` never
    // matched the row key `instant_book`, leaking raw SQLite "1" to clients.
    expect(applyCasts({ instant_book: '1' }, { instantBook: 'boolean' }, 'get'))
      .toEqual({ instant_book: true })
    expect(applyCasts({ instant_book: '0' }, { instantBook: 'boolean' }, 'get'))
      .toEqual({ instant_book: false })
  })

  it('get-direction still applies a snake-keyed cast to a snake row', () => {
    expect(applyCasts({ is_active: 1 }, { is_active: 'boolean' }, 'get'))
      .toEqual({ is_active: true })
  })

  it('set-direction on an attribute-keyed payload is unchanged (write-path regression guard)', () => {
    expect(applyCasts({ instantBook: true }, { instantBook: 'boolean' }, 'set'))
      .toEqual({ instantBook: 1 })
  })

  it('set-direction also matches a snake-keyed payload key', () => {
    expect(applyCasts({ instant_book: true }, { instantBook: 'boolean' }, 'set'))
      .toEqual({ instant_book: 1 })
  })

  it('leaves records without the cast key untouched', () => {
    expect(applyCasts({ name: 'x' }, { instantBook: 'boolean' }, 'get')).toEqual({ name: 'x' })
  })

  it('is a no-op for empty casts or nullish records, and does not mutate the input', () => {
    const row = { instant_book: '1' }
    expect(applyCasts(row, {}, 'get')).toBe(row)
    expect(applyCasts(null, { instantBook: 'boolean' }, 'get')).toBeNull()
    applyCasts(row, { instantBook: 'boolean' }, 'get')
    expect(row.instant_book).toBe('1')
  })

  it('supports custom { get, set } cast objects under both spellings', () => {
    const upper = { get: (v: unknown) => String(v).toUpperCase(), set: (v: unknown) => String(v).toLowerCase() }
    expect(applyCasts({ promo_code: 'abc' }, { promoCode: upper }, 'get')).toEqual({ promo_code: 'ABC' })
    expect(applyCasts({ promoCode: 'ABC' }, { promoCode: upper }, 'set')).toEqual({ promoCode: 'abc' })
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

describe('resolveIndexPageArgs (index ?page / ?per_page clamping)', () => {
  const args = (qs: string) => resolveIndexPageArgs(new URLSearchParams(qs))

  it('defaults to page 1 and per_page 15 (matches Model.paginate)', () => {
    expect(INDEX_DEFAULT_PER_PAGE).toBe(15)
    const { page, perPage, offset } = args('')
    expect(page).toBe(1)
    expect(perPage).toBe(15)
    expect(offset).toBe(0)
  })

  it('clamps page to >= 1 so ?page=0 / negatives never produce a negative OFFSET', () => {
    expect(args('page=0').page).toBe(1)
    expect(args('page=-5').page).toBe(1)
    expect(args('page=0').offset).toBe(0)
  })

  it('honors a valid page and computes offset = (page - 1) * perPage', () => {
    const { page, perPage, offset } = args('page=3&per_page=20')
    expect(page).toBe(3)
    expect(perPage).toBe(20)
    expect(offset).toBe(40)
  })

  it('caps per_page at the 100 max', () => {
    expect(INDEX_MAX_PER_PAGE).toBe(100)
    expect(args('per_page=500').perPage).toBe(100)
  })

  it('clamps per_page to >= 1 and falls back to the default on NaN', () => {
    expect(args('per_page=0').perPage).toBe(1)
    expect(args('per_page=abc').perPage).toBe(15)
    expect(args('page=abc').page).toBe(1)
  })
})

describe('buildIndexMeta (index pagination meta)', () => {
  it('full first page with more to come: from/to set, prev null, next -> page=2', () => {
    const meta = buildIndexMeta(new URL('http://x/api/cars?page=1'), 1, 15, 15, true)
    expect(meta.has_more_pages).toBe(true)
    expect(meta.page).toBe(1)
    expect(meta.per_page).toBe(15)
    expect(meta.from).toBe(1)
    expect(meta.to).toBe(15)
    expect(meta.prev_page_url).toBeNull()
    expect(meta.next_page_url).toContain('page=2')
    // total-gated fields stay absent without with_count.
    expect(meta.total).toBeUndefined()
    expect(meta.last_page).toBeUndefined()
    expect(meta.first_page_url).toBeUndefined()
    expect(meta.last_page_url).toBeUndefined()
  })

  it('last/partial page: hasMore false -> next null, from/to reflect the offset', () => {
    const meta = buildIndexMeta(new URL('http://x/api/cars?page=3'), 3, 15, 7, false)
    expect(meta.has_more_pages).toBe(false)
    expect(meta.from).toBe(31)
    expect(meta.to).toBe(37)
    expect(meta.next_page_url).toBeNull()
    expect(meta.prev_page_url).toContain('page=2')
  })

  it('empty page: from/to null and no next', () => {
    const meta = buildIndexMeta(new URL('http://x/api/cars?page=5'), 5, 15, 0, false)
    expect(meta.from).toBeNull()
    expect(meta.to).toBeNull()
    expect(meta.next_page_url).toBeNull()
    expect(meta.prev_page_url).toContain('page=4')
  })

  it('prev/next preserve every OTHER query param, overriding only page', () => {
    const meta = buildIndexMeta(new URL('http://x/api/cars?page=2&status=active&sort=-name'), 2, 15, 15, true)
    expect(meta.next_page_url).toContain('status=active')
    expect(meta.next_page_url).toContain('sort=-name')
    expect(meta.next_page_url).toContain('page=3')
    expect(meta.prev_page_url).toContain('status=active')
    expect(meta.prev_page_url).toContain('sort=-name')
    expect(meta.prev_page_url).toContain('page=1')
  })

  it('with_count (total known) adds total, last_page and first/last URLs', () => {
    const meta = buildIndexMeta(new URL('http://x/api/cars?page=2'), 2, 15, 15, true, 100)
    expect(meta.total).toBe(100)
    expect(meta.last_page).toBe(7) // Math.max(1, ceil(100 / 15)) = 7
    expect(meta.first_page_url).toContain('page=1')
    expect(meta.last_page_url).toContain('page=7')
  })

  it('last_page floors at 1 for an empty table (matches Paginator interface)', () => {
    const meta = buildIndexMeta(new URL('http://x/api/cars?page=1'), 1, 15, 0, false, 0)
    expect(meta.total).toBe(0)
    expect(meta.last_page).toBe(1) // Math.max(1, ceil(0 / 15)) = 1, not 0
    expect(meta.first_page_url).toContain('page=1')
    expect(meta.last_page_url).toContain('page=1')
  })

  it('returns relative pathname+search URLs (no host leak)', () => {
    const meta = buildIndexMeta(new URL('http://x/api/cars?page=1'), 1, 15, 15, true)
    expect(meta.next_page_url).toMatch(/^\/api\/cars\?/)
    expect(meta.next_page_url).not.toContain('http://')
  })

  it('#1960: top-level flat fields are emitted alongside the (deprecated) meta', () => {
    // The index route now dual-emits: flat Laravel fields at the top level
    // (current_page etc.) PLUS the deprecated `meta`. Both come from the same
    // inputs, so meta stays valid during the transition. Simulate the route's
    // emit and assert the top-level flat fields match meta for the same inputs.
    const url = new URL('http://x/api/cars?page=2')
    const meta = buildIndexMeta(url, 2, 15, 15, true, 100)
    const envelope = { data: [], ...buildIndexPaginator(url, 2, 15, 15, true, 100), meta }
    expect(envelope.current_page).toBe(meta.page)
    expect(envelope.per_page).toBe(meta.per_page)
    expect(envelope.from).toBe(meta.from)
    expect(envelope.to).toBe(meta.to)
    expect(envelope.has_more_pages).toBe(meta.has_more_pages)
    expect(envelope.prev_page_url).toBe(meta.prev_page_url)
    expect(envelope.next_page_url).toBe(meta.next_page_url)
    expect(envelope.total).toBe(meta.total)
    expect(envelope.last_page).toBe(meta.last_page)
    // meta is preserved verbatim for backward compat this release.
    expect(envelope.meta).toEqual(meta)
  })
})

describe('buildIndexPaginator (flat Laravel index shape)', () => {
  it('exposes current_page at the top level, equal to the old meta.page', () => {
    const url = new URL('http://x/api/cars?page=2')
    const p = buildIndexPaginator(url, 2, 15, 15, true)
    const meta = buildIndexMeta(url, 2, 15, 15, true)
    expect(p.current_page).toBe(2)
    expect(p.current_page).toBe(meta.page)
    // The flat shape renames page -> current_page; there is no `page` key.
    expect((p as any).page).toBeUndefined()
  })

  it('carries the same per_page/from/to/has_more_pages/prev/next as buildIndexMeta', () => {
    const url = new URL('http://x/api/cars?page=3&status=active')
    const p = buildIndexPaginator(url, 3, 15, 7, false)
    const meta = buildIndexMeta(url, 3, 15, 7, false)
    // Deep-equal minus the page->current_page rename.
    const { page: _page, ...metaRest } = meta
    const { current_page: _current, ...pRest } = p
    expect(pRest).toEqual(metaRest)
    expect(p.per_page).toBe(15)
    expect(p.from).toBe(31)
    expect(p.to).toBe(37)
    expect(p.has_more_pages).toBe(false)
    expect(p.next_page_url).toBeNull()
    expect(p.prev_page_url).toContain('page=2')
  })

  it('without with_count: total/last_page/first_page_url/last_page_url stay undefined', () => {
    const p = buildIndexPaginator(new URL('http://x/api/cars?page=1'), 1, 15, 15, true)
    expect(p.total).toBeUndefined()
    expect(p.last_page).toBeUndefined()
    expect(p.first_page_url).toBeUndefined()
    expect(p.last_page_url).toBeUndefined()
  })

  it('with_count adds total, last_page and first/last URLs (last_page floors at 1)', () => {
    const p = buildIndexPaginator(new URL('http://x/api/cars?page=2'), 2, 15, 15, true, 100)
    expect(p.total).toBe(100)
    expect(p.last_page).toBe(7) // Math.max(1, ceil(100 / 15)) = 7
    expect(p.first_page_url).toContain('page=1')
    expect(p.last_page_url).toContain('page=7')

    const empty = buildIndexPaginator(new URL('http://x/api/cars?page=1'), 1, 15, 0, false, 0)
    expect(empty.last_page).toBe(1) // Math.max(1, ceil(0 / 15)) = 1, not 0
  })

  it('empty page: from/to null and no next page', () => {
    const p = buildIndexPaginator(new URL('http://x/api/cars?page=5'), 5, 15, 0, false)
    expect(p.from).toBeNull()
    expect(p.to).toBeNull()
    expect(p.next_page_url).toBeNull()
  })

  it('deep-equals the shared fields of a Model.paginate() envelope', () => {
    // A full page of 15 rows on page 2 of a 100-row table (last_page 7).
    const rows = Array.from({ length: 15 }, (_, i) => ({ id: i + 16 }))
    const expected = toPaginator({ data: rows, meta: { perPage: 15, page: 2, total: 100, lastPage: 7 } })
    const p = buildIndexPaginator(new URL('http://x/api/cars?page=2'), 2, 15, rows.length, true, 100)
    // Prove a client can treat a generated-endpoint list response and a
    // Model.paginate() response identically across the shared paginator fields
    // (the flat shape omits `path`, so compare shared keys, not strict equality).
    expect(p.current_page).toBe(expected.current_page)
    expect(p.per_page).toBe(expected.per_page)
    expect(p.total).toBe(expected.total)
    expect(p.last_page).toBe(expected.last_page)
    expect(p.from).toBe(expected.from)
    expect(p.to).toBe(expected.to)
    expect(p.has_more_pages).toBe(expected.has_more_pages)
  })
})
