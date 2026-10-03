import { log } from '@stacksjs/logging'

/**
 * Apply every model's declared retention policy, daily (stacksjs/stacks#365).
 *
 * A model opts in with `traits.gdpr.retention`:
 *
 * ```ts
 * traits: { gdpr: { retention: { days: 90, action: 'delete' } } }
 * ```
 *
 * Nothing is pruned for a model that declares no policy, so this job is a
 * no-op until one does. `buddy gdpr:prune --dry-run` shows what it would do.
 * Each run that changes something writes a `retention` row to `gdpr_requests`.
 */
export default class PruneRetainedDataJob {
  public static config = {
    schedule: '30 3 * * *', // Daily at 03:30, clear of the midnight prune jobs
    withoutOverlapping: true,
    timeout: 15 * 60,
    retries: 3,
    retryAfter: [60, 300, 900],
  }

  public static async handle(): Promise<{ changed: number, results: Array<{ model: string, action: string, changed: number }> }> {
    const { pruneRetainedData } = await import('@stacksjs/orm')

    try {
      const result = await pruneRetainedData({ actor: 'scheduler' })
      const changed = result.changes.reduce((sum, change) => sum + change.changed, 0)

      if (result.skipped.length)
        log.info(`Retention: declared tables not in this database: ${result.skipped.join(', ')}`)
      log.info(`Retention applied: ${changed} row(s) changed across ${result.changes.length} model(s)`)

      return {
        changed,
        results: result.changes.map(({ model, action, changed }) => ({ model, action, changed })),
      }
    }
    catch (error) {
      log.error('Failed to apply retention policies:', error)
      throw error
    }
  }
}
