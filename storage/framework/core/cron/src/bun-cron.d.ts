declare module 'bun' {
  type CronExpression =
    | '* * * * *'
    | '@yearly'
    | '@annually'
    | '@monthly'
    | '@weekly'
    | '@daily'
    | '@midnight'
    | '@hourly'
    | (string & {})

  interface BunCron {
    /**
     * Register an OS-level cron job that runs a JavaScript/TypeScript module on a schedule.
     *
     * @param path - Path to the script to run (resolved relative to caller)
     * @param schedule - Cron expression (5-field) or predefined nickname (@daily, @hourly, etc.)
     * @param title - Unique job identifier (alphanumeric, hyphens, underscores only)
     */
    (path: string, schedule: CronExpression, title: string): Promise<void>

    /**
     * Parse a cron expression and return the next matching UTC Date.
     *
     * @param expression - A 5-field cron expression or nickname
     * @param relativeDate - Starting point for the search (defaults to Date.now())
     * @returns The next Date matching the expression, or null if no match within ~4 years
     */
    parse(expression: CronExpression, relativeDate?: Date | number): Date | null

    /**
     * Remove a previously registered OS-level cron job by its title.
     *
     * @param title - The title of the cron job to remove
     */
    remove(title: string): Promise<void>
  }

  var cron: BunCron
}
