import type { Result } from '@stacksjs/error-handling'
import { randomBytes } from 'node:crypto'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'
import { HttpError, ok } from '@stacksjs/error-handling'

export async function createPersonalAccessClient(): Promise<Result<string, never>> {
  const secret = randomBytes(40).toString('hex')

  await db.insertInto('oauth_clients')
    .values({
      name: 'Personal Access Client',
      secret,
      provider: 'local',
      redirect: 'http://localhost',
      personal_access_client: true,
      password_client: false,
      revoked: false,
      created_at: formatDate(new Date()),
    })
    .execute()

  const inserted = await db.selectFrom('oauth_clients')
    .where('secret', '=', secret)
    .select(['id'])
    .executeTakeFirst()

  if (!inserted?.id)
    throw new HttpError(500, 'Failed to create personal access client')

  return ok(secret)
}
