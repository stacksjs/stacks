import { db } from '@stacksjs/database/runtime'
import { sql } from '@stacksjs/database/runtime'
import { log } from '@stacksjs/logging'

export interface UpdateErrorData {
  status?: number
  additional_info?: string
}

/**
 * Update a single error by ID
 */
export async function update(id: number, data: UpdateErrorData): Promise<boolean> {
  try {
    await db
      .updateTable('errors')
      .set({
        ...data,
        updated_at: sql.raw('CURRENT_TIMESTAMP'),
      })
      .where('id', '=', id)
      .execute()
    return true
  }
  catch (error) {
    log.error('[commerce/errors] update failed', { id, error })
    return false
  }
}

/**
 * Set the HTTP status on several errors at once.
 *
 * This is the HTTP status and nothing else. Triage goes through
 * `resolveGroup`, `ignoreGroup` and `unresolveGroup`, which write
 * `resolution` (stacksjs/stacks#2923).
 */
export async function bulkUpdateStatus(ids: number[], status: number): Promise<boolean> {
  try {
    await db
      .updateTable('errors')
      .set({
        status,
        updated_at: sql.raw('CURRENT_TIMESTAMP'),
      })
      .where('id', 'in', ids)
      .execute()
    return true
  }
  catch (error) {
    log.error('[commerce/errors] bulkUpdateStatus failed', { count: ids.length, status, error })
    return false
  }
}

/**
 * Resolve a grouped error.
 *
 * Writes `resolution`, not `status`. It used to set `status = 1`, which
 * overwrote the HTTP status the error reported and could never be read back
 * as resolved on a seeded row (stacksjs/stacks#2923).
 */
export async function resolveGroup(type: string, message: string): Promise<boolean> {
  try {
    await db
      .updateTable('errors')
      .set({
        resolution: 'resolved',
        updated_at: sql.raw('CURRENT_TIMESTAMP'),
      })
      .where('type', '=', type)
      .where('message', '=', message)
      .execute()
    return true
  }
  catch (error) {
    log.error('[commerce/errors] resolveGroup failed', { type, message, error })
    return false
  }
}

/** Ignore a grouped error. Writes `resolution`; see `resolveGroup`. */
export async function ignoreGroup(type: string, message: string): Promise<boolean> {
  try {
    await db
      .updateTable('errors')
      .set({
        resolution: 'ignored',
        updated_at: sql.raw('CURRENT_TIMESTAMP'),
      })
      .where('type', '=', type)
      .where('message', '=', message)
      .execute()
    return true
  }
  catch (error) {
    log.error('[commerce/errors] ignoreGroup failed', { type, message, error })
    return false
  }
}

/** Return a grouped error to the queue. Writes `resolution`; see `resolveGroup`. */
export async function unresolveGroup(type: string, message: string): Promise<boolean> {
  try {
    await db
      .updateTable('errors')
      .set({
        resolution: 'unresolved',
        updated_at: sql.raw('CURRENT_TIMESTAMP'),
      })
      .where('type', '=', type)
      .where('message', '=', message)
      .execute()
    return true
  }
  catch (error) {
    log.error('[commerce/errors] unresolveGroup failed', { type, message, error })
    return false
  }
}
