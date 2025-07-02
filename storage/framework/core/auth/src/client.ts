import type { Ok } from '@stacksjs/error-handling'
import { randomBytes } from 'node:crypto'
import { db } from '@stacksjs/database'
import { HttpError, ok } from '@stacksjs/error-handling'

export async function createPersonalAccessClient(): Promise<Ok<string, never>> {
  const secret = randomBytes(40).toString('hex')

  const result = await db.insertInto('oauth_clients')
    .values({
      name: 'Personal Access Client',
      secret,
      provider: 'local',
      redirect: 'http://localhost',
      personal_access_client: true,
      password_client: false,
      revoked: false,
    })
    .executeTakeFirst()

  const insertId = result?.insertId || Number(result?.numInsertedOrUpdatedRows)

  if (!insertId)
    throw new HttpError(500, 'Failed to create personal access client')

  return ok(secret)
}
