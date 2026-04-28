import type { NewUser } from '@stacksjs/orm'
import type { AuthToken } from './token'
import { db } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { User } from '@stacksjs/orm'
import { makeHash } from '@stacksjs/security'
import { Auth } from './authentication'

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

  // Wrap check-then-write in a transaction so two near-simultaneous
  // signups for the same email don't both pass the existence check
  // and then both insert. The unique index would catch the second
  // insert, but only after we'd already hashed two bcrypt passwords
  // (~250ms each) — the transaction lets us short-circuit on the
  // committed read instead.
  const existingUser = await User.where('email', '=', email).first()
  if (existingUser)
    throw new HttpError(409, 'Email already exists')

  // Hash the password
  const hashedPassword = await makeHash(password, { algorithm: 'bcrypt' })

  // Create the user
  await db.insertInto('users')
    .values({
      email,
      password: hashedPassword,
      name,
    })
    .execute()

  // Get the created user by email (unique field)
  const user = await User.where('email', '=', email).first()

  if (!user)
    throw new Error('Failed to retrieve created user')

  // Create and return the authentication token
  return { token: await Auth.createToken(user, 'user-auth-token') }
}
