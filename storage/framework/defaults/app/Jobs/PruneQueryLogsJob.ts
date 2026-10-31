import { config } from '@stacksjs/config'
import { log } from '@stacksjs/logging'
import QueryController from '../Controllers/QueryController'

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

      // Not skipped when logging is off: switching it off stops new rows, and
      // the ones already written still have to expire. The query logger also
      // prunes on its own while it writes, so this job is a backstop for apps
      // that schedule it, not the only thing standing between a busy app and
      // an unbounded table.
      // Prune old query logs
      // `pruneQueryLogs` is an instance method - the routes reach it through
      // 'Controllers/QueryController@method', which instantiates for them.
      const result = await new QueryController().pruneQueryLogs()

      log.info(`Successfully pruned ${result.pruned} query logs older than ${result.retentionDays} days`)

      return result
    }
    catch (error) {
      log.error('Failed to prune query logs:', error)
      throw error
    }
  }
}
