import { log } from '@stacksjs/cli'
import { Every } from '@stacksjs/types'
import { Job } from '@stacksjs/queue'

export default new Job({
  name: 'Demo Job', // defaults to the file name
  description: 'A demo cron job that runs every 5th minute', // optional
  schedule: Every.FifthMinute, // optional, run it on a schedule. alternatively, '*/5 * * * *'
  run: () => { // or `action: () => {`
    log.info('This cron job runs at every 5th minute')
  },
  // `run: 'demo-job'` is another option where `demo-job` refers to ./resources/functions/demo-job.ts
  tries: 3, // defaults to 3, in case of failures
  backoff: 3, // defaults to 3-second delays between retries
})

// export default {
//   name: 'Demo Job', // defaults to the file name
//   description: , // optional
//   schedule: Every.FifthMinute, // optional, run it on a schedule. alternatively, '*/5 * * * *'
//   run: () => { // or `action: () => {`
//     log.info('This cron job runs at every 5th minute')
//   },
//   // `run: 'demo-job'` is another option where `demo-job` refers to ./resources/functions/demo-job.ts
//   tries: 3, // defaults to 3, in case of failures
//   backoff: 3, // defaults to 3-second delays between retries
// } satisfies Job
