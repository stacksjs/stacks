import { config } from '@stacksjs/config'
import { log } from '@stacksjs/logging'
import QueryController from '../Actions/Queries/QueryController'

export default class PruneQueryLogsJob {
  /**
   * Job configuration
   */
  public static config = {
    // Run the job based on the configured frequency, defaulting to daily
    schedule: config.database?.queryLogging?.pruneFrequency
      ? `0 */${config.database.queryLogging.pruneFrequency} * * *` // Every X hours
      : '0 0 * * *', // Daily at midnight

    // Prevent overlapping job executions
    withoutOverlapping: true,

    // Timeout after 5 minutes
    timeout: 5 * 60,

    // Retry up to 3 times with exponential backoff
    retries: 3,
    retryAfter: [60, 120, 300], // seconds
  }

  /**
   * Execute the job
   */
  public static async handle() {
    try {
      log.info('Running query logs pruning job')

      // Skip if query logging is disabled
      if (!config.database?.queryLogging?.enabled) {
        log.info('Query logging is disabled, skipping pruning job')
        return
      }

      // Prune old query logs
      const result = await QueryController.pruneQueryLogs()

      log.info(`Successfully pruned ${result.pruned} query logs older than ${result.retentionDays} days`)

      return result
    }
    catch (error) {
      log.error('Failed to prune query logs:', error)
      throw error
    }
  }
}
