import type { Result } from '@stacksjs/error-handling'
import { randomBytes } from 'node:crypto'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'
import { err, HttpError, ok } from '@stacksjs/error-handling'
import { makeHash } from '@stacksjs/security'

export interface CreatePersonalAccessClientError {
  code: 'already-exists'
  message: string
}

/**
 * Create a personal access OAuth client.
 *
 * Idempotent: returns an `err({ code: 'already-exists' })` when a
 * non-revoked personal access client already exists in the
 * `oauth_clients` table, rather than inserting a duplicate. The
 * previous behaviour silently created a second row, which made
 * `getPersonalAccessClient()` (which `LIMIT 1`s with no `ORDER BY`)
 * return whichever the DB happened to surface first — racy with
 * subsequent token mints. See stacksjs/stacks#1860 M-7.
 *
 * The plaintext secret is what callers (e.g., `./buddy auth:token`)
 * surface to the operator — they store it themselves. The DB holds
 * only the bcrypt hash so a DB compromise doesn't leak usable client
 * credentials (stacksjs/stacks#1861 M-1).
 */
export async function createPersonalAccessClient(): Promise<Result<string, CreatePersonalAccessClientError>> {
  // Idempotency check: refuse to insert a second personal access
  // client. The existing one may already be in use by deployed
  // services that have stored its secret — silently creating a
  // duplicate makes `getPersonalAccessClient()` non-deterministic
  // (`LIMIT 1` with no ORDER BY).
  const existing = await db.selectFrom('oauth_clients')
    .where('personal_access_client', '=', true)
    .where('revoked', '=', false)
    .select(['id'])
    .executeTakeFirst()

  if (existing?.id) {
    return err({
      code: 'already-exists',
      message: 'A personal access client already exists. Revoke the existing client (`./buddy auth:revoke-client`) before creating a new one.',
    })
  }

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
