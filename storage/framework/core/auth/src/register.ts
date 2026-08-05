import type { NewUser } from '@stacksjs/orm'
import type { AuthToken } from './token'
import { config } from '@stacksjs/config'
import { db } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { User } from '@stacksjs/orm'
import { makeHash } from '@stacksjs/security'
import { Auth } from './authentication'
import { isUniqueViolation } from './rbac-store-bqb'

/**
 * The error thrown when a registration collides with an existing email.
 *
 * By default it says so plainly (friendlier UX). With
 * `config.auth.registration.preventEnumeration` enabled it returns a generic
 * 422 that an attacker can't use to confirm an address is registered
 * (stacksjs/stacks#1985). Timing is already equalized (the bcrypt hash runs
 * before any existence check), so the response body was the last oracle.
 */
function duplicateEmailError(): HttpError {
  if ((config.auth as any)?.registration?.preventEnumeration)
    return new HttpError(422, 'Registration could not be completed. Please check your details and try again.')
  return new HttpError(409, 'Email already exists')
}

// RFC 5322-ish: a single @ with at least one dot in the domain. Tighter than
// "any non-empty string" but loose enough to accept IDN/Unicode locals,
// which `validator.isEmail()` would have to special-case anyway.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * What a successful registration hands back: a complete session, matching
 * `Auth.loginUsingId()`.
 *
 * Named rather than inlined on the signature so consumers can type the result,
 * and because pickier's unused-parameter analysis mis-reads a multi-line return
 * annotation and flags `credentials` as unused.
 */
export interface RegistrationResult {
  token: AuthToken
  refreshToken?: string
  expiresIn?: number
}

/**
 * Register a user and open a full session for them.
 *
 * Returns the same triple `Auth.loginUsingId()` does. It used to return only
 * the access token, because it called `Auth.createToken()` — a wrapper that
 * mints a refresh token and an expiry and then throws both away. With
 * `config.auth.tokenExpiry` defaulting to one hour, that made every freshly
 * registered account unable to refresh: a client that correctly stores the pair
 * and exchanges it at `/auth/refresh` worked for everyone except the user who
 * had just signed up, who was logged out an hour into their first session
 * (stacksjs/stacks#2212).
 *
 * Additive, so `const { token } = await register(...)` is unaffected.
 */
export async function register(credentials: NewUser): Promise<RegistrationResult> {
  const { email, password, name } = credentials

  // Cheap structural validation before we hit the DB. Bad-email registration
  // attempts used to insert "" or "user" as an email and only fail at the
  // unique index, leaking timing info about real signups in the process.
  if (typeof email !== 'string' || email.length > 254 || !EMAIL_RE.test(email)) {
    throw new HttpError(422, 'Email address is invalid')
  }
  if (typeof password !== 'string' || password.length < 8) {
    throw new HttpError(422, 'Password must be at least 8 characters')
  }

  // Hash before any DB query so duplicate and fresh registrations pay
  // the same ~250ms bcrypt cost. Checking existence first returned the
  // 409 in ~1ms — a timing oracle on registered emails on top of the
  // explicit response body, inconsistent with attempt()'s dummy-hash
  // hardening and password-reset's silent no-op (stacksjs/stacks#1953).
  const hashedPassword = await makeHash(password, { algorithm: 'bcrypt' })

  // Check + insert + read-back run in one transaction. The in-tx
  // existence check is best-effort: under READ COMMITTED two
  // concurrent transactions can both pass it, so the unique-violation
  // catch on the insert is the authoritative duplicate signal (once
  // the users.email unique index is enforced — see #1952). The row is
  // read back inside the trx rather than via insertGetId/RETURNING:
  // insertGetId escapes the transaction's connection, and MySQL has
  // no INSERT...RETURNING.
  const userId = await db.transaction(async (rawTrx) => {
    // The transaction callback receives bun-query-builder's raw `QueryBuilder<DB>`,
    // which marks chained fluent methods like `selectAll` as optional. We mirror
    // the typing of the top-level `db` proxy so chained calls type-check the same way.
    const trx = rawTrx as unknown as typeof db

    const existingUser = await trx
      .selectFrom('users')
      .where('email', '=', email)
      .selectAll()
      .executeTakeFirst()
    if (existingUser)
      throw duplicateEmailError()

    try {
      await trx.insertInto('users')
        .values({
          email,
          password: hashedPassword,
          name,
        })
        .execute()
    }
    catch (err) {
      if (isUniqueViolation(err))
        throw duplicateEmailError()
      throw err
    }

    const created = await trx
      .selectFrom('users')
      .where('email', '=', email)
      .selectAll()
      .executeTakeFirst()

    if (!created)
      throw new Error('Failed to retrieve created user')

    return Number(created.id)
  })

  const user = await User.find(userId)

  if (!user)
    throw new Error('Failed to retrieve created user')

  // `createTokenForUser`, not `createToken` — the latter drops the refresh
  // token and expiry on the floor. Same token name as before.
  const { plainTextToken, refreshToken, expiresIn } = await Auth.createTokenForUser(user, {
    name: 'user-auth-token',
  })

  return { token: plainTextToken, refreshToken, expiresIn }
}
