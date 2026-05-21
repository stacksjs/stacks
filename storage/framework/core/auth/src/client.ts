import type { Result } from '@stacksjs/error-handling'
import { randomBytes } from 'node:crypto'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'
import { HttpError, ok } from '@stacksjs/error-handling'
import { makeHash } from '@stacksjs/security'

export async function createPersonalAccessClient(): Promise<Result<string, never>> {
  // The plaintext secret is what callers (e.g., `./buddy auth:token`)
  // surface to the operator — they store it themselves. The DB holds
  // only the bcrypt hash so a DB compromise doesn't leak usable
  // client credentials (stacksjs/stacks#1861 M-1). `validateClient`
  // accepts either form on read, so legacy plaintext rows continue
  // to validate during the rolling migration.
  const secret = randomBytes(40).toString('hex')
  const hashedSecret = await makeHash(secret, { algorithm: 'bcrypt' })

  await db.insertInto('oauth_clients')
    .values({
      name: 'Personal Access Client',
      secret: hashedSecret,
      provider: 'local',
      redirect: 'http://localhost',
      personal_access_client: true,
      password_client: false,
      revoked: false,
      created_at: formatDate(new Date()),
    })
    .execute()

  // Look up the freshly inserted row by hash (not by plaintext) so
  // the SELECT works against the value we actually wrote.
  const inserted = await db.selectFrom('oauth_clients')
    .where('secret', '=', hashedSecret)
    .select(['id'])
    .executeTakeFirst()

  if (!inserted?.id)
    throw new HttpError(500, 'Failed to create personal access client')

  return ok(secret)
}
