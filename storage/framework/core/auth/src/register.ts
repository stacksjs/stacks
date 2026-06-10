import type { NewUser } from '@stacksjs/orm'
import type { AuthToken } from './token'
import { db } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { User } from '@stacksjs/orm'
import { makeHash } from '@stacksjs/security'
import { Auth } from './authentication'
import { isUniqueViolation } from './rbac-store-bqb'

// RFC 5322-ish: a single @ with at least one dot in the domain. Tighter than
// "any non-empty string" but loose enough to accept IDN/Unicode locals,
// which `validator.isEmail()` would have to special-case anyway.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function register(credentials: NewUser): Promise<{ token: AuthToken }> {
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
      throw new HttpError(409, 'Email already exists')

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
        throw new HttpError(409, 'Email already exists')
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

  // Create and return the authentication token
  return { token: await Auth.createToken(user, 'user-auth-token') }
}
