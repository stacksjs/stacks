import { db } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

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
    console.error('Error updating error record:', error)
    return false
  }
}

/**
 * Update multiple errors by IDs (for bulk status updates on grouped errors)
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
    console.error('Error bulk updating error records:', error)
    return false
  }
}

/**
 * Resolve a grouped error (sets status = 1 for all errors in the group)
 */
export async function resolveGroup(type: string, message: string): Promise<boolean> {
  try {
    await db
      .updateTable('errors')
      .set({
        status: 1,
        updated_at: sql.raw('CURRENT_TIMESTAMP'),
      })
      .where('type', '=', type)
      .where('message', '=', message)
      .execute()
    return true
  }
  catch (error) {
    console.error('Error resolving error group:', error)
    return false
  }
}

/**
 * Ignore a grouped error (sets status = 2 for all errors in the group)
 */
export async function ignoreGroup(type: string, message: string): Promise<boolean> {
  try {
    await db
      .updateTable('errors')
      .set({
        status: 2,
        updated_at: sql.raw('CURRENT_TIMESTAMP'),
      })
      .where('type', '=', type)
      .where('message', '=', message)
      .execute()
    return true
  }
  catch (error) {
    console.error('Error ignoring error group:', error)
    return false
  }
}

/**
 * Unresolve a grouped error (sets status = 0 for all errors in the group)
 */
export async function unresolveGroup(type: string, message: string): Promise<boolean> {
  try {
    await db
      .updateTable('errors')
      .set({
        status: 0,
        updated_at: sql.raw('CURRENT_TIMESTAMP'),
      })
      .where('type', '=', type)
      .where('message', '=', message)
      .execute()
    return true
  }
  catch (error) {
    console.error('Error unresolving error group:', error)
    return false
  }
}
