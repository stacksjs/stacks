import type { CronJob } from '@stacksjs/types'

export default {
  // required
  schedule: '*/5 * * * *', // at every 5th minute
  action: () => {
    // eslint-disable-next-line no-console
    console.log('This cron job runs every 5th minute')
  },

  // optional
  name: 'Demo Job',
  description: 'A demo cron job that runs every 5th minute',
} satisfies CronJob
