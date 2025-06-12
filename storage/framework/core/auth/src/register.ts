import type { NewUser } from '@stacksjs/orm'
import type { AuthToken } from './token'
import { db } from '@stacksjs/database'
import { User } from '@stacksjs/orm'
import { makeHash } from '@stacksjs/security'
import { Auth } from './authentication'

export async function register(credentials: NewUser): Promise<{ token: AuthToken } | null> {
  const { email, password, name } = credentials

  // Check if user already exists
  const existingUser = await User.where('email', '=', email).first()

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
    })
    .executeTakeFirst()

  const insertId = Number(result?.insertId) || Number(result?.numInsertedOrUpdatedRows)

  if (!insertId)
    return null

  // Get the created user
  const user = await User.find(insertId)

  if (!user)
    return null

  // Create and return the authentication token
  return { token: await Auth.createToken(user, 'user-auth-token') }
}
