import { log } from '@stacksjs/cli'
import { Every } from '@stacksjs/types'
import type { CronJob } from '@stacksjs/types'

// TODO: create `job` shortcut (snippet)
export default {
  // required
  schedule: Every.FifthMinute, // or '*/5 * * * *'
  action: () => {
    log.info('This cron job runs at every 5th minute')
  },

  // optional
  name: 'Demo Job',
  description: 'A demo cron job that runs every 5th minute',
} satisfies CronJob
