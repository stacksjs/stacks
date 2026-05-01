import { db } from '@stacksjs/database'
import { log } from '@stacksjs/logging'

/**
 * Delete a single error by ID
 */
export async function destroy(id: number): Promise<boolean> {
  try {
    await db
      .deleteFrom('errors')
      .where('id', '=', id)
      .execute()
    return true
  }
  catch (error) {
    log.error('[commerce/errors] destroy failed', { id, error })
    return false
  }
}

/**
 * Delete multiple errors by IDs
 */
export async function bulkDestroy(ids: number[]): Promise<boolean> {
  try {
    await db
      .deleteFrom('errors')
      .where('id', 'in', ids)
      .execute()
    return true
  }
  catch (error) {
    log.error('[commerce/errors] bulkDestroy failed', { count: ids.length, error })
    return false
  }
}

/**
 * Delete all errors in a group (by type and message)
 */
export async function destroyGroup(type: string, message: string): Promise<boolean> {
  try {
    await db
      .deleteFrom('errors')
      .where('type', '=', type)
      .where('message', '=', message)
      .execute()
    return true
  }
  catch (error) {
    log.error('[commerce/errors] destroyGroup failed', { type, message, error })
    return false
  }
}
