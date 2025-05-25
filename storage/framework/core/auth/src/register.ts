import type { AuthToken } from './token'
import { Authentication } from './authentication'
import { db } from '@stacksjs/database'
import { makeHash } from '@stacksjs/security'

interface RegisterCredentials {
  email: string
  password: string
  name: string
  job_title: string
}

export async function register(credentials: RegisterCredentials): Promise<{ token: AuthToken } | null> {
  const { email, password, name, job_title } = credentials

  // Check if user already exists
  const existingUser = await db.selectFrom('users')
    .where('email', '=', email)
    .selectAll()
    .executeTakeFirst()

  if (existingUser)
    return null

  // Hash the password
  const hashedPassword = await makeHash(password, { algorithm: 'bcrypt' })


  // Create the user
  const result = await db.insertInto('users')
    .values({
      email,
      password: hashedPassword,
      name,
      job_title,
    })
    .executeTakeFirst()

    const insertId = Number(result?.insertId) || Number(result?.numInsertedOrUpdatedRows)

  if (!result?.insertId)
    return null

  // Get the created user
  const user = await db.selectFrom('users')
    .where('id', '=', insertId)
    .selectAll()
    .executeTakeFirst()

  if (!user)
    return null

  // Create and return the authentication token
  return { token: await Authentication.createToken(user, 'user-auth-token') }
}
