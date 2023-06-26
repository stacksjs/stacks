import { log } from '@stacksjs/cli'
import { Every } from '@stacksjs/types'
import type { CronJob } from '@stacksjs/types'

export default {
  name: 'Demo Job', // defaults to the file name
  description: 'A demo cron job that runs every 5th minute', // optional
  schedule: Every.FifthMinute, // optional, run it on a schedule. alternatively, '*/5 * * * *'
  run: () => { // or `action: () => {`
    log.info('This cron job runs at every 5th minute')
  },
  // `run: 'demo-job'` is another option where `demo-job` refers to ./resources/functions/demo-job.ts
} satisfies CronJob
