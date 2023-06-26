import { Every } from '@stacksjs/types'
import type { CronJob } from '@stacksjs/types'

export default {
  // required
  schedule: Every.FifthMinute, // or '*/5 * * * *'
  action: () => {
    // eslint-disable-next-line no-console
    console.log('This cron job runs every 5th minute')
  },

  // optional
  name: 'Demo Job',
  description: 'A demo cron job that runs every 5th minute',
} satisfies CronJob
