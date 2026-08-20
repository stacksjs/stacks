/**
 * Regression tests for stacksjs/stacks#1953 — `register()` hardening:
 *
 *   1. Timing oracle: bcrypt must run BEFORE the existence check so
 *      duplicate and fresh registrations cost the same (~250ms);
 *      pre-fix the 409 returned in ~1ms for registered emails.
 *   2. Race: check + insert + read-back must run inside one
 *      transaction, with a unique-violation catch on the insert as the
 *      authoritative duplicate signal (two concurrent transactions can
 *      both pass the read under READ COMMITTED).
 *   3. The read-back happens in-transaction; the post-commit fetch
 *      uses the id, not a `where(email).first()` that resolves
 *      arbitrarily once duplicates exist.
 *
 * The full ORM boot (userland User model, validation, traits) is far
 * too heavy for a unit test, so the collaborators are stubbed with
 * `mock.module` BEFORE `../src/register` is imported, and every DB/hash
 * operation records into a shared `ops` array so tests can assert
 * ordering — the core of the timing-oracle regression.
 */

import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import { HttpError } from '@stacksjs/error-handling'

// `mock.module` is process-wide and bun does NOT restore it between
// test files, so capture the real modules other test files in this
// package rely on (password-reset-revocation.test.ts queries the real
// `db`; reset.ts hashes with the real `makeHash`) and put them back in
// afterAll. The spread matters: mocking patches the live namespace in
// place, so a bare namespace capture would "restore" the mock itself —
// which also means the capture has to happen BEFORE the mock below.
//
// Every mock this file installs is captured, including
// `../src/authentication` and `@stacksjs/orm`. An earlier version left
// those two mocked on the way out, reasoning that no other file in the
// directory imported them. That was wrong, and it did not fail loudly:
// `Auth` stayed a plain object carrying nothing but the `createTokenForUser`
// stub below, so every later file in a whole-directory run saw
// `Auth.revokeToken` and friends as undefined, and the class behind the
// framework's documented auth entry point could not be covered by a test
// that runs in CI at all (stacksjs/stacks#2309).
const realDatabase = { ...await import('@stacksjs/database') }
const realSecurity = { ...await import('@stacksjs/security') }
const realOrm = { ...await import('@stacksjs/orm') }
const realAuthentication = { ...await import('../src/authentication') }
// Read at module scope (top-level await is fine here, inside a `describe` it is
// not). #2281's cases toggle `auth.registration` on the live config object,
// which `duplicateEmailError` reads per call.
const realConfig = await import('@stacksjs/config')

afterAll(() => {
  mock.module('@stacksjs/database', () => realDatabase)
  mock.module('@stacksjs/security', () => realSecurity)
  mock.module('@stacksjs/orm', () => realOrm)
  mock.module('../src/authentication', () => realAuthentication)
})

// ─── Shared recording state ─────────────────────────────────────────

const ops: string[] = []

interface Scenario {
  /** Row returned by the in-tx existence check (null = email free). */
  existingRow: Record<string, unknown> | null
  /** Error thrown by the in-tx INSERT (null = success). */
  insertError: unknown | null
}

const scenario: Scenario = { existingRow: null, insertError: null }

const CREATED_ROW = { id: 7, email: 'fresh@example.com', name: 'Fresh' }

let transactionCalled = false
let insertRanOnTrx = false
let insertedValues: Record<string, unknown> | null = null
let selectCalls = 0
let userFindId: number | null = null

function resetState(): void {
  ops.length = 0
  scenario.existingRow = null
  scenario.insertError = null
  transactionCalled = false
  insertRanOnTrx = false
  insertedValues = null
  selectCalls = 0
  userFindId = null
}

// ─── Module stubs (must precede the register import) ────────────────

function makeTrx() {
  return {
    selectFrom: () => {
      const chain = {
        where: () => chain,
        selectAll: () => chain,
        executeTakeFirst: async () => {
          ops.push('select')
          selectCalls++
          // First select = existence check, second = post-insert read-back.
          return selectCalls === 1 ? scenario.existingRow : CREATED_ROW
        },
      }
      return chain
    },
    insertInto: () => ({
      values: (v: Record<string, unknown>) => ({
        execute: async () => {
          ops.push('insert')
          insertRanOnTrx = true
          if (scenario.insertError)
            throw scenario.insertError
          insertedValues = v
        },
      }),
    }),
  }
}

mock.module('@stacksjs/database', () => ({
  db: {
    transaction: async (fn: (trx: unknown) => Promise<unknown>) => {
      transactionCalled = true
      return await fn(makeTrx())
    },
    // Top-level query entry points poison the run: register() must do
    // all its reads/writes on the trx, not the global connection.
    selectFrom: () => {
      throw new Error('register() used the top-level db instead of the transaction')
    },
    insertInto: () => {
      throw new Error('register() used the top-level db instead of the transaction')
    },
  },
}))

mock.module('@stacksjs/security', () => ({
  makeHash: async (value: string) => {
    ops.push('hash')
    return `hashed:${value}`
  },
}))

mock.module('@stacksjs/orm', () => ({
  User: {
    find: async (id: number) => {
      ops.push('find')
      userFindId = id
      return { id, email: CREATED_ROW.email, name: CREATED_ROW.name }
    },
  },
}))

mock.module('../src/authentication', () => ({
  Auth: {
    // `createTokenForUser`, not `createToken`. Registration has to mint the
    // whole session — `createToken` is a wrapper that discards the refresh
    // token and expiry, which left every new account unable to refresh
    // (stacksjs/stacks#2212).
    createTokenForUser: async () => ({
      plainTextToken: 'tok_test',
      refreshToken: 'refresh_test',
      expiresIn: 3600,
    }),
  },
}))

const { register } = await import('../src/register')

// ─── Tests ──────────────────────────────────────────────────────────

beforeEach(resetState)

describe('register() input validation (unchanged 422 guards)', () => {
  test('invalid email → 422 before any hashing', async () => {
    await expect(register({ email: 'not-an-email', password: 'long-enough-pw', name: 'X' } as any))
      .rejects.toMatchObject({ status: 422 })
    expect(ops).not.toContain('hash')
  })

  test('password under 8 chars → 422 before any hashing', async () => {
    await expect(register({ email: 'a@b.co', password: 'short', name: 'X' } as any))
      .rejects.toMatchObject({ status: 422 })
    expect(ops).not.toContain('hash')
  })
})

describe('register() timing-oracle hardening (#1953)', () => {
  test('duplicate email is rejected, and bcrypt ran BEFORE the existence check', async () => {
    scenario.existingRow = { id: 1, email: 'taken@example.com' }

    await expect(register({ email: 'taken@example.com', password: 'long-enough-pw', name: 'X' } as any))
      .rejects.toMatchObject({ status: 422 })

    // The regression: pre-fix this was ['select'] with no 'hash' —
    // registered emails returned in ~1ms while fresh ones paid bcrypt.
    expect(ops).toEqual(['hash', 'select'])
  })
})

// stacksjs/stacks#2281 — #1985 built the generic-response seam but left it
// opt-in, so every scaffolded app served `409 Email already exists`: an
// account-existence oracle for anyone who wanted to enumerate users. Timing
// was equalized above; the response body was the last channel open.
describe('register() does not confirm whether an address is registered (#2281)', () => {
  const authConfig = realConfig.config.auth as any
  const original = authConfig?.registration

  afterAll(() => {
    if (authConfig)
      authConfig.registration = original
  })

  test('an unset flag means protected, not exposed', async () => {
    if (authConfig)
      delete authConfig.registration
    scenario.existingRow = { id: 1, email: 'taken@example.com' }

    // The decisive assertion: the message must not distinguish this from any
    // other rejection. `409 Email already exists` is the answer to "does this
    // account exist", handed over on request.
    await expect(register({ email: 'taken@example.com', password: 'long-enough-pw', name: 'X' } as any))
      .rejects.toMatchObject({ status: 422 })

    await expect(register({ email: 'taken@example.com', password: 'long-enough-pw', name: 'X' } as any))
      .rejects.not.toMatchObject({ message: 'Email already exists' })
  })

  test('explicitly disabling it brings the specific 409 back', async () => {
    if (authConfig)
      authConfig.registration = { preventEnumeration: false }
    scenario.existingRow = { id: 1, email: 'taken@example.com' }

    await expect(register({ email: 'taken@example.com', password: 'long-enough-pw', name: 'X' } as any))
      .rejects.toMatchObject({ status: 409, message: 'Email already exists' })
  })

  test('only an explicit false disables it - a truthy or absent value stays protected', async () => {
    for (const registration of [undefined, {}, { preventEnumeration: true }]) {
      if (authConfig)
        authConfig.registration = registration as any
      scenario.existingRow = { id: 1, email: 'taken@example.com' }

      await expect(register({ email: 'taken@example.com', password: 'long-enough-pw', name: 'X' } as any))
        .rejects.toMatchObject({ status: 422 })
    }
  })
})

describe('register() transactional create (#1953)', () => {
  test('fresh email → token, hashed password inserted inside the trx, fetch by id', async () => {
    const result = await register({ email: 'fresh@example.com', password: 'long-enough-pw', name: 'Fresh' } as any)

    // The full session, not just the access token — a registration that hands
    // back no refresh token strands the account at `tokenExpiry` (one hour by
    // default) with no way to renew (stacksjs/stacks#2212).
    expect(result).toEqual({
      token: 'tok_test' as any,
      refreshToken: 'refresh_test',
      expiresIn: 3600,
    })
    expect(transactionCalled).toBe(true)
    expect(insertRanOnTrx).toBe(true)
    // Never the plaintext.
    expect(insertedValues).toEqual({
      email: 'fresh@example.com',
      password: 'hashed:long-enough-pw',
      name: 'Fresh',
    })
    // Post-commit fetch must use the id read back inside the trx, not
    // an email lookup that resolves arbitrarily once duplicates exist.
    expect(userFindId).toBe(7)
    expect(ops).toEqual(['hash', 'select', 'insert', 'select', 'find'])
  })

  for (const [label, err] of [
    ['SQLITE_CONSTRAINT_UNIQUE', { code: 'SQLITE_CONSTRAINT_UNIQUE' }],
    ['MySQL errno 1062', { errno: 1062 }],
    ['Postgres 23505', { code: '23505' }],
  ] as const) {
    // Routed through the same `duplicateEmailError` as the pre-check path, so
    // the two are indistinguishable from outside. If the race path answered
    // 409 while the pre-check answered 422, losing the race would itself be
    // the oracle (stacksjs/stacks#2281).
    test(`lost race - insert throws ${label} → mapped to a duplicate rejection`, async () => {
      scenario.insertError = err

      await expect(register({ email: 'racer@example.com', password: 'long-enough-pw', name: 'X' } as any))
        .rejects.toMatchObject({ status: 422 })
    })
  }

  test('non-duplicate insert failure propagates unchanged', async () => {
    scenario.insertError = Object.assign(new Error('connection lost'), { code: 'ECONNRESET' })

    const err = await register({ email: 'unlucky@example.com', password: 'long-enough-pw', name: 'X' } as any)
      .then(() => null, (e: unknown) => e)
    expect(err).toBeInstanceOf(Error)
    expect((err as Error).message).toBe('connection lost')
    expect(err).not.toBeInstanceOf(HttpError)
  })
})
