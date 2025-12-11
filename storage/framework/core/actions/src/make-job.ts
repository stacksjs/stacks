import type { MakeOptions } from '@stacksjs/types'
import { log } from '@stacksjs/logging'
import * as p from '@stacksjs/path'
import { writeFile } from '@stacksjs/storage'

/**
 * Create a new job file in app/Jobs
 */
export async function makeJob(options: MakeOptions): Promise<boolean> {
  const name = options.name

  if (!name) {
    log.error('Job name is required')
    return false
  }

  // Ensure name ends with Job
  const jobName = name.endsWith('Job') ? name : `${name}Job`

  // Determine job type
  const isClassBased = options.class ?? false

  // Generate job content
  const content = isClassBased
    ? generateClassBasedJob(jobName, options)
    : generateFunctionBasedJob(jobName, options)

  // Write the file
  const filePath = p.userJobsPath(`${jobName}.ts`)

  try {
    await writeFile(filePath, content)
    log.success(`Created job: ${filePath}`)
    return true
  }
  catch (error) {
    log.error(`Failed to create job: ${(error as Error).message}`)
    return false
  }
}

/**
 * Generate function-based job content
 */
function generateFunctionBasedJob(name: string, options: MakeOptions): string {
  const queue = options.queue || 'default'
  const tries = options.tries || 3
  const backoff = options.backoff || 3

  return `import { Job } from '@stacksjs/queue'

export default new Job({
  /**
   * The job name (optional, defaults to filename)
   */
  name: '${name}',

  /**
   * A description of what this job does (optional)
   */
  description: 'TODO: Add job description',

  /**
   * The queue this job should be dispatched to
   */
  queue: '${queue}',

  /**
   * Number of times to retry if the job fails
   */
  tries: ${tries},

  /**
   * Seconds to wait between retry attempts
   */
  backoff: ${backoff},

  /**
   * Cron expression for scheduled jobs (optional)
   * Examples:
   *   - '* * * * *' - Every minute
   *   - '0 * * * *' - Every hour
   *   - '0 0 * * *' - Every day at midnight
   */
  // rate: '* * * * *',

  /**
   * Backoff configuration for advanced retry strategies (optional)
   */
  // backoffConfig: {
  //   strategy: 'exponential', // 'fixed' | 'exponential' | 'linear'
  //   initialDelay: 1000,
  //   factor: 2,
  //   maxDelay: 60000,
  // },

  /**
   * Handle the job
   * @param payload - The job payload data
   * @returns The result of the job processing
   */
  async handle(payload: any) {
    // TODO: Implement job logic
    console.log('Processing job with payload:', payload)

    return { success: true }
  },
})
`
}

/**
 * Generate class-based job content
 */
function generateClassBasedJob(name: string, options: MakeOptions): string {
  const queue = options.queue || 'default'
  const tries = options.tries || 3

  return `import { log } from '@stacksjs/logging'

/**
 * ${name}
 *
 * TODO: Add job description
 */
export default class ${name} {
  /**
   * Job configuration
   */
  public static config = {
    /**
     * The queue this job should be dispatched to
     */
    queue: '${queue}',

    /**
     * Cron expression for scheduled jobs (optional)
     * Examples:
     *   - '* * * * *' - Every minute
     *   - '0 * * * *' - Every hour
     *   - '0 0 * * *' - Every day at midnight
     */
    // schedule: '0 0 * * *',

    /**
     * Prevent overlapping job executions
     */
    withoutOverlapping: false,

    /**
     * Timeout in seconds
     */
    timeout: 60,

    /**
     * Number of retry attempts
     */
    retries: ${tries},

    /**
     * Delay between retries in seconds
     */
    retryAfter: [60, 120, 300],
  }

  /**
   * Execute the job
   * @param payload - The job payload data
   */
  public static async handle(payload?: any): Promise<any> {
    try {
      log.info('${name}: Starting job execution')

      // TODO: Implement job logic
      console.log('Processing with payload:', payload)

      log.info('${name}: Job completed successfully')

      return { success: true }
    }
    catch (error) {
      log.error('${name}: Job failed:', error)
      throw error
    }
  }
}
`
}
