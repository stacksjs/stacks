import { randomBytes } from 'node:crypto'
import { db, sql } from '@stacksjs/database'
import { HttpError, type Ok } from '@stacksjs/error-handling'
import { ok } from '@stacksjs/error-handling'

export async function createPersonalAccessClient(userId: number): Promise<Ok<string, never>> {
  const secret = randomBytes(40).toString('hex')

  const result = await db.insertInto('oauth_clients')
    .values({
      user_id: userId,
      name: 'Personal Access Client',
      secret,
      provider: 'local',
      redirect: 'http://localhost',
      personal_access_client: true,
      password_client: false,
      revoked: false,
    })
    .executeTakeFirst()

  if (!result?.insertId)
    throw new HttpError(500, 'Failed to create personal access client')

  return ok(secret)
}
