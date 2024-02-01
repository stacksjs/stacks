import { Job } from '@stacksjs/queue'
import { Every } from '@stacksjs/types'

export default new Job({
  name: 'Send Welcome Email', // defaults to the file name
  description: 'A demo cron job that runs every 5th minute', // optional
  tries: 3, // defaults to 3, in case of failures
  backoff: 3, // defaults to 3-second delays between retries
  schedule: Every.FiveSeconds, // '*/5 * * * *' in cron syntax (overwrites the Scheduler's definition)
  handle: () => { // or `action: () => {`
    log.info('This cron job will get based ')
  },
  // action: 'SendWelcomeEmail', // instead of handle, you may target an action
})
