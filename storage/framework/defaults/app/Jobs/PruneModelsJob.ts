import { log } from '@stacksjs/logging'
import { prunable } from '@stacksjs/orm'

export default class PruneModelsJob {
  public static config = {
    schedule: '0 0 * * *', // Daily at midnight
    withoutOverlapping: true,
    timeout: 5 * 60,
    retries: 3,
    retryAfter: [60, 120, 300],
  }

  /**
   * The models to prune and their configurations.
   * Add entries here to register prunable models.
   */
  private static prunableModels: Array<{
    table: string
    olderThanDays?: number
    column?: string
    query?: (qb: any) => any
  }> = []

  /**
   * Register a model for pruning.
   */
  public static register(table: string, options: { olderThanDays?: number, column?: string, query?: (qb: any) => any } = {}): void {
    PruneModelsJob.prunableModels.push({ table, ...options })
  }

  public static async handle(): Promise<{ total: number, results: Array<{ table: string, pruned: number }> }> {
    try {
      log.info('Running model pruning job')

      const results: Array<{ table: string, pruned: number }> = []
      let total = 0

      for (const model of PruneModelsJob.prunableModels) {
        const pruned = await prunable(model.table, {
          olderThanDays: model.olderThanDays,
          column: model.column,
          query: model.query,
        })

        results.push({ table: model.table, pruned })
        total += pruned
      }

      log.info(`Model pruning complete: ${total} records pruned across ${results.length} models`)

      return { total, results }
    }
    catch (error) {
      log.error('Failed to prune models:', error)
      throw error
    }
  }
}
