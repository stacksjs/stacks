import { log } from '@stacksjs/cli'
import { Job } from '@stacksjs/queue'
import { Every } from '@stacksjs/types'

export default new Job({
  rate: Every.TwoMinutes, // optional, '*/2 * * * *' in cron syntax
  handle: () => {
    log.info('This cron job log this message every two minutes')
    log.info('Please note, any job may also be dispatched individually, or scheduled via ./app/Schedule')
  },
  // action: 'SendWelcomeEmail', // instead of handle, you may target an action or `action: () => {`
})
