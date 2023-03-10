import { defineCronJobsConfig } from '../.stacks/core/config/src/helpers'

/**
 * **Cron Jobs Configuration**
 *
 * This configuration defines all of your Cron Jobs options. Because Stacks is fully-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default defineCronJobsConfig([
  {
    name: 'Demo Cron Job', // optional
    function: '/demo', // ./functions/demo.ts
    schedule: '*/5 * * * *', // at every 5th minute
    description: 'A demo cron job that runs at every 5th minute', // optional
    timezone: 'America/New_York', // optional, defaults to APP_TIMEZONE
    enabled: true, // optional, defaults to true
  },
])
