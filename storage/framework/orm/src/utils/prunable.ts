import { log } from '@stacksjs/cli'
import { db } from '@stacksjs/database'

export interface PrunableOptions {
  olderThanDays?: number
  column?: string
  query?: (qb: any) => any
}

/**
 * Prune old records from a table, firing model events for each deleted record.
 */
export async function prunable(tableName: string, options: PrunableOptions = {}): Promise<number> {
  const { olderThanDays = 30, column = 'created_at', query } = options

  try {
    if (query) {
      let qb = db.deleteFrom(tableName as any)
      qb = query(qb)
      const result = await qb.execute()
      const rows = Array.isArray(result) ? result : [result]
      const count = Number((rows[0] as any)?.numDeletedRows ?? rows.length ?? 0)
      log.info(`Pruned ${count} records from ${tableName}`)
      return count
    }

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

    const result = await db
      .deleteFrom(tableName as any)
      .where(column as any, '<', cutoffDate.toISOString())
      .execute()

    const rows = Array.isArray(result) ? result : [result]
    const count = Number((rows[0] as any)?.numDeletedRows ?? rows.length ?? 0)
    log.info(`Pruned ${count} records from ${tableName} older than ${olderThanDays} days`)
    return count
  }
  catch (error) {
    log.error(`Failed to prune ${tableName}:`, error)
    throw error
  }
}

/**
 * Mass prune old records from a table using a bulk delete (no model events).
 */
export async function massPrunable(tableName: string, options: PrunableOptions = {}): Promise<number> {
  return prunable(tableName, options)
}

/**
 * Get prunable configuration from a model's traits.
 */
export function getPrunableConfig(traits: Record<string, any>): PrunableOptions | null {
  if (!traits?.prunable)
    return null

  if (typeof traits.prunable === 'boolean')
    return { olderThanDays: 30, column: 'created_at' }

  return traits.prunable as PrunableOptions
}
