import { db } from '@stacksjs/database'

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
    console.error('Error deleting error record:', error)
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
    console.error('Error bulk deleting error records:', error)
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
    console.error('Error deleting error group:', error)
    return false
  }
}
