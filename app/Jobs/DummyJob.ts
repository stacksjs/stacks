import { Job } from '@stacksjs/queue'
import { Every } from '@stacksjs/types'
import { log } from '@stacksjs/cli'

export default new Job({
  name: 'Send Welcome Email', // defaults to the file name
  description: 'A demo cron job that runs every 5 seconds', // optional
  queue: 'default', // defaults to 'default'
  tries: 3, // defaults to 3, in case of failures
  backoff: 3, // defaults to 3-second delays between retries
  schedule: Every.FiveSeconds, // '*/5 * * * *' in cron syntax (overwrites the Scheduler's definition)
  handle: () => {
    log.info('This cron job log this message every 5 seconds')
  },
  // action: 'SendWelcomeEmail', // instead of handle, you may target an action or `action: () => {`
})
