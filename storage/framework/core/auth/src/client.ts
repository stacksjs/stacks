import type { Ok } from '@stacksjs/error-handling'
import { randomBytes } from 'node:crypto'
import { db } from '@stacksjs/database'
import { HttpError, ok } from '@stacksjs/error-handling'

export async function createPersonalAccessClient(): Promise<Ok<string, never>> {
  const secret = randomBytes(40).toString('hex')

  // Use unsafe SQL for more reliable execution
  const result = await db.unsafe(`
    INSERT INTO oauth_clients (name, secret, provider, redirect, personal_access_client, password_client, revoked, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `, ['Personal Access Client', secret, 'local', 'http://localhost', 1, 0, 0]).execute()

  // Get the last inserted row ID
  const lastId = await db.unsafe('SELECT last_insert_rowid() as id').execute()
  const insertId = (lastId as any)?.[0]?.id || 1

  if (!insertId)
    throw new HttpError(500, 'Failed to create personal access client')

  return ok(secret)
}
